/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

// system-monitor: Gnome shell extension displaying system informations in gnome shell status bar, such as memory usage, cpu usage, network rates…
// Copyright (C) 2011 Florian Mounier aka paradoxxxzero

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// Author: Florian Mounier aka paradoxxxzero

/* Ugly. This is here so that we don't crash old libnm-glib based shells unnecessarily
 * by loading the new libnm.so. Should go away eventually */

var libnm_glib = imports.gi.GIRepository.Repository.get_default().is_registered('NMClient', '1.0');

var smDepsGtop = true;
var smDepsNM = true;

var Config = imports.misc.config;
var Clutter = imports.gi.Clutter;
var GLib = imports.gi.GLib;
var GObject = imports.gi.GObject;
var Lang = imports.lang;

var Gio = imports.gi.Gio;
var Shell = imports.gi.Shell;
var St = imports.gi.St;
const UPower = imports.gi.UPowerGlib;

// const System = imports.system;
var ModalDialog = imports.ui.modalDialog;

var ByteArray = imports.byteArray;

var ExtensionSystem = imports.ui.extensionSystem;
var ExtensionUtils = imports.misc.extensionUtils;

var Me = ExtensionUtils.getCurrentExtension();
var Convenience = Me.imports.convenience;
var Compat = Me.imports.compat;

var Background, GTop, IconSize, Locale, MountsMonitor, NM, NetworkManager, Schema, StatusArea, Style, gc_timeout, menu_timeout;

try {
    GTop = imports.gi.GTop;
} catch (e) {
    log('[System monitor] catched error: ' + e);
    smDepsGtop = false;
}

try {
    NM = libnm_glib ? imports.gi.NMClient : imports.gi.NM;
    NetworkManager = libnm_glib ? imports.gi.NetworkManager : NM;
} catch (e) {
    log('[System monitor] catched error: ' + e);
    smDepsNM = false;
}

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Gettext = imports.gettext.domain('system-monitor');
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const _ = Gettext.gettext;

const MESSAGE = _('Dependencies Missing\n\
Please install: \n\
gnome-system-monitor and libgtop, clutter and Network Manager gir bindings \n\
\t    on Debian and Ubuntu: gir1.2-gtop-2.0, gir1.2-nm-1.0, gir1.2-clutter-1.0, gnome-system-monitor \n\
\t    on Fedora: libgtop2-devel, NetworkManager-libnm-devel, gnome-system-monitor \n\
\t    on Arch: libgtop, networkmanager, gnome-system-monitor\n\
\t    on openSUSE: typelib-1_0-GTop-2_0, typelib-1_0-NetworkManager-1_0, gnome-system-monitor \n\
\t    on Mageia 64-bit: lib64gtop-gir2.0, lib64nm-gir1.0, lib64clutter-gir1.0, gnome-system-monitor\n');

// stale network shares will cause the shell to freeze, enable this with caution
const ENABLE_NETWORK_DISK_USAGE = false;

let extension = imports.misc.extensionUtils.getCurrentExtension();
let metadata = extension.metadata;
let shell_Version = Config.PACKAGE_VERSION;

Clutter.Actor.prototype.raise_top = function raise_top() {
    const parent = this.get_parent();
    if (!parent) {
        return;
    }
    parent.set_child_above_sibling(this, null);
}
Clutter.Actor.prototype.reparent = function reparent(newParent) {
    const parent = this.get_parent();
    if (parent) {
        parent.remove_child(this);
    }
    newParent.add_child(this);
}

function parse_bytearray(bytearray) {
    if (!ByteArray.toString(bytearray).match(/GjsModule byteArray/)) {
        return ByteArray.toString(bytearray);
    }
    return bytearray
}

function l_limit(t) {
    return (t > 0) ? t : 1000;
}

function change_text() {
    this.label.visible = Schema.get_boolean(this.elt + '-show-text');
}

function change_style() {
    let style = Schema.get_string(this.elt + '-style');
    this.text_box.visible = style === 'digit' || style === 'both';
    this.chart.actor.visible = style === 'graph' || style === 'both';
}

function build_menu_info() {
    let elts = Main.__sm.elts;
    let tray_menu = Main.__sm.tray.menu;

    if (tray_menu._getMenuItems().length &&
        typeof tray_menu._getMenuItems()[0].actor.get_last_child() !== 'undefined') {
        tray_menu._getMenuItems()[0].actor.get_last_child().destroy_all_children();
        for (let elt in elts) {
            elts[elt].menu_items = elts[elt].create_menu_items();
        }
    } else {
        return;
    }

    let menu_info_box_table = new St.Widget({
        style: 'padding: 10px 0px 10px 0px; spacing-rows: 10px; spacing-columns: 15px;',
        layout_manager: new Clutter.GridLayout({orientation: Clutter.Orientation.VERTICAL})
    });
    let menu_info_box_table_layout = menu_info_box_table.layout_manager;

    // Populate Table
    let row_index = 0;
    for (let elt in elts) {
        if (!elts[elt].menu_visible) {
            continue;
        }

        // Add item name to table
        menu_info_box_table_layout.attach(
            new St.Label({
                text: elts[elt].item_name,
                style_class: Style.get('sm-title'),
                x_align: Clutter.ActorAlign.START,
                y_align: Clutter.ActorAlign.CENTER
            }), 0, row_index, 1, 1);

        // Add item data to table
        let col_index = 1;
        for (let item in elts[elt].menu_items) {
            menu_info_box_table_layout.attach(
                elts[elt].menu_items[item], col_index, row_index, 1, 1);

            col_index++;
        }

        row_index++;
    }
    if (shell_Version < '3.36') {
        tray_menu._getMenuItems()[0].actor.get_last_child().add(menu_info_box_table, {expand: true});
    } else {
        tray_menu._getMenuItems()[0].actor.get_last_child().add_child(menu_info_box_table);
    }
}

function change_menu() {
    this.menu_visible = Schema.get_boolean(this.elt + '-show-menu');
    build_menu_info();
}

function change_usage() {
    let usage = Schema.get_string('disk-usage-style');
    Main.__sm.pie.show(usage === 'pie');
    Main.__sm.bar.show(usage === 'bar');
}
let color_from_string = Compat.color_from_string;

function interesting_mountpoint(mount) {
    if (mount.length < 3) {
        return false;
    }

    return ((mount[0].indexOf('/dev/') === 0 || mount[2].toLowerCase() === 'nfs') && mount[2].toLowerCase() !== 'udf');
}


const smStyleManager = class SystemMonitor_smStyleManager {
    constructor() {
        this._extension = '';
        this._iconsize = 1;
        this._diskunits = _('MiB/s');
        this._netunits_kbytes = _('KiB/s');
        this._netunits_mbytes = _('MiB/s');
        this._netunits_gbytes = _('GiB/s');
        this._netunits_kbits = _('kbit/s');
        this._netunits_mbits = _('Mbit/s');
        this._netunits_gbits = _('Gbit/s');
        this._pie_size = 300;
        this._pie_fontsize = 14;
        this._bar_width = 300;
        this._bar_thickness = 15;
        this._bar_fontsize = 14;
        this._compact = Schema.get_boolean('compact-display');

        if (this._compact) {
            this._extension = '-compact';
            this._iconsize = 3 / 5;
            this._diskunits = _('MB');
            this._netunits_kbytes = _('kB');
            this._netunits_mbytes = _('MB');
            this._netunits_gbytes = _('GB');
            this._netunits_kbits = 'kb';
            this._netunits_mbits = 'Mb';
            this._netunits_gbits = 'Gb';
            this._pie_size *= 4 / 5;
            this._pie_fontsize = 12;
            this._bar_width *= 3 / 5;
            this._bar_thickness = 12;
            this._bar_fontsize = 12;
        }
    }
    get(style) {
        return style + this._extension;
    }
    iconsize() {
        return this._iconsize;
    }
    diskunits() {
        return this._diskunits;
    }
    netunits_kbytes() {
        return this._netunits_kbytes;
    }
    netunits_mbytes() {
        return this._netunits_mbytes;
    }
    netunits_gbytes() {
        return this._netunits_gbytes;
    }
    netunits_kbits() {
        return this._netunits_kbits;
    }
    netunits_mbits() {
        return this._netunits_mbits;
    }
    netunits_gbits() {
        return this._netunits_gbits;
    }
    pie_size() {
        return this._pie_size;
    }
    pie_fontsize() {
        return this._pie_fontsize;
    }
    bar_width() {
        return this._bar_width;
    }
    bar_thickness() {
        return this._bar_thickness;
    }
    bar_fontsize() {
        return this._bar_fontsize;
    }
}

const smDialog = class SystemMonitor_smDialog extends ModalDialog.ModalDialog {
    constructor() {
        super({styleClass: 'prompt-dialog'});
        let mainContentBox = new St.BoxLayout({style_class: 'prompt-dialog-main-layout',
            vertical: false});
        this.contentLayout.add(mainContentBox,
            {x_fill: true,
                y_fill: true});

        let messageBox = new St.BoxLayout({style_class: 'prompt-dialog-message-layout',
            vertical: true});
        mainContentBox.add(messageBox,
            {y_align: St.Align.START});

        this._subjectLabel = new St.Label({style_class: 'prompt-dialog-headline',
            text: _('System Monitor Extension')});

        messageBox.add(this._subjectLabel,
            {y_fill: false,
                y_align: St.Align.START});

        this._descriptionLabel = new St.Label({style_class: 'prompt-dialog-description',
            text: MESSAGE});

        messageBox.add(this._descriptionLabel,
            {y_fill: true,
                y_align: St.Align.START});


        this.setButtons([
            {
                label: _('Cancel'),
                action: () => {
                    this.close();
                },
                key: Clutter.Escape
            }
        ]);
    }
}

const Chart = class SystemMonitor_Chart {
    constructor(width, height, parent) {
        this.actor = new St.DrawingArea({style_class: Style.get('sm-chart'), reactive: false});
        this.parentC = parent;
        this.width = width;
        let themeContext = St.ThemeContext.get_for_stage(global.stage);
        this.scale_factor = themeContext.scale_factor;
        this.actor.set_width(this.width * this.scale_factor);
        this.actor.set_height(height);
        this.data = [];
        for (let i = 0; i < this.parentC.colors.length; i++) {
            this.data[i] = [];
        }
        themeContext.connect('notify::scale-factor', this.rescale.bind(this));
        this.actor.connect('repaint', this._draw.bind(this));
    }
    update() {
        let data_a = this.parentC.vals;
        if (data_a.length !== this.parentC.colors.length) {
            return;
        }
        let accdata = [];
        for (let l = 0; l < data_a.length; l++) {
            accdata[l] = (l === 0) ? data_a[0] : accdata[l - 1] + ((data_a[l] > 0) ? data_a[l] : 0);
            this.data[l].push(accdata[l]);
            if (this.data[l].length > this.width) {
                this.data[l].shift();
            }
        }
        if (!this.actor.visible) {
            return;
        }
        this.actor.queue_repaint();
    }
    _draw() {
        if (!this.actor.visible) {
            return;
        }
        let [width, height] = this.actor.get_surface_size();
        let cr = this.actor.get_context();
        let max;
        if (this.parentC.max) {
            max = this.parentC.max;
        } else {
            max = Math.max.apply(this, this.data[this.data.length - 1]);
            max = Math.max(1, Math.pow(2, Math.ceil(Math.log(max) / Math.log(2))));
        }
        Clutter.cairo_set_source_color(cr, Background);
        cr.rectangle(0, 0, width, height);
        cr.fill();
        for (let i = this.parentC.colors.length - 1; i >= 0; i--) {
            let samples = this.data[i].length - 1;
            if (samples > 0) {
                cr.moveTo(width, height); // bottom right
                let x = width - 0.25 * this.scale_factor;
                cr.lineTo(x, (1 - this.data[i][samples] / max) * height);
                x -= 0.5 * this.scale_factor;
                for (let j = samples; j >= 0; j--) {
                    let y = (1 - this.data[i][j] / max) * height;
                    cr.lineTo(x, y);
                    x -= 0.5 * this.scale_factor;
                    cr.lineTo(x, y);
                    x -= 0.5 * this.scale_factor;
                }
                x += 0.25 * this.scale_factor;
                cr.lineTo(x, (1 - this.data[i][0] / max) * height);
                cr.lineTo(x, height);
                cr.closePath();
                Clutter.cairo_set_source_color(cr, this.parentC.colors[i]);
                cr.fill();
            }
        }
        cr.$dispose();
    }
    resize(width) {
        if (this.width === width) {
            return;
        }
        this.width = width;
        if (this.width < this.data[0].length) {
            for (let i = 0; i < this.parentC.colors.length; i++) {
                this.data[i] = this.data[i].slice(-this.width);
            }
        }
        this.actor.set_width(this.width * this.scale_factor); // repaints
    }
    rescale(themeContext) {
        this.scale_factor = themeContext.scale_factor;
        this.actor.set_width(this.width * this.scale_factor); // repaints
    }
}

// Class to deal with volumes insertion / ejection
const smMountsMonitor = class SystemMonitor_smMountsMonitor {
    constructor() {
        this.files = [];
        this.num_mounts = -1;
        this.listeners = [];
        this.connected = false;

        this._volumeMonitor = Gio.VolumeMonitor.get();
        let sys_mounts = ['/home', '/tmp', '/boot', '/usr', '/usr/local'];
        this.base_mounts = ['/'];
        sys_mounts.forEach((sMount) => {
            if (this.is_sys_mount(sMount + '/')) {
                this.base_mounts.push(sMount);
            }
        });
        this.connect();
    }
    refresh() {
        // try check that number of volumes has changed
        // try {
        //     let num_mounts = this.manager.getMounts().length;
        //     if (num_mounts == this.num_mounts)
        //         return;
        //     this.num_mounts = num_mounts;
        // } catch (e) {};

        // Can't get mountlist:
        // GTop.glibtop_get_mountlist
        // Error: No symbol 'glibtop_get_mountlist' in namespace 'GTop'
        // Getting it with mtab
        // let mount_lines = Shell.get_file_contents_utf8_sync('/etc/mtab').split("\n");
        // this.mounts = [];
        // for(let mount_line in mount_lines) {
        //     let mount = mount_lines[mount_line].split(" ");
        //     if(interesting_mountpoint(mount) && this.mounts.indexOf(mount[1]) < 0) {
        //         this.mounts.push(mount[1]);
        //     }
        // }
        // log("[System monitor] old mounts: " + this.mounts);
        this.mounts = [];
        for (let base in this.base_mounts) {
            // log("[System monitor] " + this.base_mounts[base]);
            this.mounts.push(this.base_mounts[base]);
        }
        let mount_lines = this._volumeMonitor.get_mounts();
        mount_lines.forEach((mount) => {
            if ((!this.is_net_mount(mount) || ENABLE_NETWORK_DISK_USAGE) &&
                 !this.is_ro_mount(mount)) {
                let mpath = mount.get_root().get_path() || mount.get_default_location().get_path();
                if (mpath) {
                    this.mounts.push(mpath);
                }
            }
        });
        // log("[System monitor] base: " + this.base_mounts);
        // log("[System monitor] mounts: " + this.mounts);
        for (let i in this.listeners) {
            this.listeners[i](this.mounts);
        }
    }
    add_listener(cb) {
        this.listeners.push(cb);
    }
    remove_listener(cb) {
        this.listeners.pop(cb);
    }
    get_mounts() {
        return this.mounts;
    }
    is_sys_mount(mpath) {
        let file = Gio.file_new_for_path(mpath);
        let info = file.query_info(Gio.FILE_ATTRIBUTE_UNIX_IS_MOUNTPOINT,
            Gio.FileQueryInfoFlags.NONE, null);
        return info.get_attribute_boolean(Gio.FILE_ATTRIBUTE_UNIX_IS_MOUNTPOINT);
    }
    is_ro_mount(mount) {
        // FIXME: running this function after "login after waking from suspend"
        // can make login hang. Actual issue seems to occur when a former net
        // mount got broken (e.g. due to a VPN connection terminated or
        // otherwise broken connection)
        try {
            let file = mount.get_default_location();
            let info = file.query_filesystem_info(Gio.FILE_ATTRIBUTE_FILESYSTEM_READONLY, null);
            return info.get_attribute_boolean(Gio.FILE_ATTRIBUTE_FILESYSTEM_READONLY);
        } catch (e) {
            return false;
        }
    }
    is_net_mount(mount) {
        try {
            let file = mount.get_default_location();
            let info = file.query_filesystem_info(Gio.FILE_ATTRIBUTE_FILESYSTEM_TYPE, null);
            let result = info.get_attribute_string(Gio.FILE_ATTRIBUTE_FILESYSTEM_TYPE);
            let net_fs = ['nfs', 'smbfs', 'cifs', 'ftp', 'sshfs', 'sftp', 'mtp', 'mtpfs'];
            return !file.is_native() || net_fs.indexOf(result) > -1;
        } catch (e) {
            return false;
        }
    }
    connect() {
        if (this.connected) {
            return;
        }
        try {
            this.manager = this._volumeMonitor;
            this.mount_added_id = this.manager.connect('mount-added', this.refresh.bind(this));
            this.mount_removed_id = this.manager.connect('mount-removed', this.refresh.bind(this));
            // need to add the other signals here
            this.connected = true;
        } catch (e) {
            log('[System monitor] Failed to register on placesManager notifications');
            log('[System monitor] Got exception : ' + e);
        }
        this.refresh();
    }
    disconnect() {
        if (!this.connected) {
            return;
        }
        this.manager.disconnect(this.mount_added_id);
        this.manager.disconnect(this.mount_removed_id);
        this.connected = false;
    }
    destroy() {
        this.disconnect();
    }
}

const Graph = class SystemMonitor_Graph {
    constructor(width, height) {
        this.menu_item = '';
        this.actor = new St.DrawingArea({style_class: Style.get('sm-chart'), reactive: false});
        this.width = width;
        this.height = height;
        this.gtop = new GTop.glibtop_fsusage();
        this.colors = ['#888', '#aaa', '#ccc'];
        for (let color in this.colors) {
            this.colors[color] = color_from_string(this.colors[color]);
        }

        let themeContext = St.ThemeContext.get_for_stage(global.stage);
        themeContext.connect('notify::scale-factor', this.set_scale.bind(this));
        this.scale_factor = themeContext.scale_factor;
        let interfaceSettings = new Gio.Settings({
            schema: 'org.gnome.desktop.interface'
        });
        interfaceSettings.connect('changed', this.set_text_scaling.bind(this));
        this.text_scaling = interfaceSettings.get_double('text-scaling-factor');
        if (!this.text_scaling) {
            this.text_scaling = 1;
        }

        this.actor.set_width(this.width * this.scale_factor * this.text_scaling);
        this.actor.set_height(this.height * this.scale_factor * this.text_scaling);
        this.actor.connect('repaint', this._draw.bind(this));
    }
    create_menu_item() {
        this.menu_item = new PopupMenu.PopupBaseMenuItem({reactive: false});
        if (shell_Version < '3.36') {
            this.menu_item.actor.add(this.actor, {span: -1, expand: true});
        } else {
            this.menu_item.actor.add_child(this.actor);
        }
        // tray.menu.addMenuItem(this.menu_item);
    }
    show(visible) {
        this.menu_item.actor.visible = visible;
    }
    set_scale(themeContext) {
        this.scale_factor = themeContext.scale_factor;
        this.actor.set_width(this.width * this.scale_factor * this.text_scaling);
        this.actor.set_height(this.height * this.scale_factor * this.text_scaling);
    }
    set_text_scaling(interfaceSettings, key) {
        // FIXME: for some reason we only get this signal once, not on later
        // changes to the setting
        //log('[System monitor] got text scaling signal');
        this.text_scaling = interfaceSettings.get_double(key);
        this.actor.set_width(this.width * this.scale_factor * this.text_scaling);
        this.actor.set_height(this.height * this.scale_factor * this.text_scaling);
    }
}

const Bar = class SystemMonitor_Bar extends Graph {
    constructor() {
        // Height doesn't matter, it gets set on every draw.
        super(Style.bar_width(), 100);
        this.mounts = MountsMonitor.get_mounts();
        MountsMonitor.add_listener(this.update_mounts.bind(this));
    }
    _draw() {
        if (!this.actor.visible) {
            return;
        }
        let thickness = Style.bar_thickness() * this.scale_factor * this.text_scaling;
        let fontsize = Style.bar_fontsize() * this.scale_factor * this.text_scaling;
        this.actor.set_height(this.mounts.length * (3 * thickness));
        let [width, height] = this.actor.get_surface_size();
        let cr = this.actor.get_context();

        let x0 = width / 8;
        let y0 = thickness / 2;
        cr.setLineWidth(thickness);
        cr.setFontSize(fontsize);
        for (let mount in this.mounts) {
            GTop.glibtop_get_fsusage(this.gtop, this.mounts[mount]);
            let perc_full = (this.gtop.blocks - this.gtop.bfree) / this.gtop.blocks;
            Clutter.cairo_set_source_color(cr, this.colors[mount % this.colors.length]);

            var text = this.mounts[mount];
            if (text.length > 10) {
                text = text.split('/').pop();
            }
            cr.moveTo(0, y0 + thickness / 3);
            cr.showText(text);
            cr.moveTo(width - x0, y0 + thickness / 3);
            cr.showText(Math.round(perc_full * 100).toString() + '%');
            y0 += (5 * thickness) / 4;

            cr.moveTo(0, y0);
            cr.relLineTo(perc_full * width, 0);
            cr.stroke();
            y0 += (7 * thickness) / 4;
        }
        cr.$dispose();
    }
    update_mounts(mounts) {
        this.mounts = mounts;
        this.actor.queue_repaint();
    }
}

const Pie = class SystemMonitor_Pie extends Graph {
    constructor() {
        super(Style.pie_size(), Style.pie_size());
        this.mounts = MountsMonitor.get_mounts();
        MountsMonitor.add_listener(this.update_mounts.bind(this));
    }

    _draw() {
        if (!this.actor.visible) {
            return;
        }
        let [width, height] = this.actor.get_surface_size();
        let cr = this.actor.get_context();
        let xc = width / 2;
        let yc = height / 2;
        let pi = Math.PI;
        function arc(r, value, max, angle) {
            if (max === 0) {
                return angle;
            }
            let new_angle = angle + (value * 2 * pi / max);
            cr.arc(xc, yc, r, angle, new_angle);
            return new_angle;
        }

        // Set the ring thickness so that at least 7 rings can be displayed. If
        // there are more mounts, make the rings thinner. If the rings are too
        // thin to have a line height of 1.2 for the labels, shrink the labels.
        let rings = Math.max(this.mounts.length, 7);
        let ring_width = width / (2 * rings);
        let fontsize = Style.pie_fontsize() * this.scale_factor * this.text_scaling;
        if (ring_width < 1.2 * fontsize) {
            fontsize = ring_width / 1.2;
        }
        let thickness = ring_width / 1.5;

        cr.setLineWidth(thickness);
        cr.setFontSize(fontsize);
        let r = (height - ring_width) / 2;
        for (let mount in this.mounts) {
            GTop.glibtop_get_fsusage(this.gtop, this.mounts[mount]);
            Clutter.cairo_set_source_color(cr, this.colors[mount % this.colors.length]);
            arc(r, this.gtop.blocks - this.gtop.bfree, this.gtop.blocks, -pi / 2);
            cr.stroke();
            r -= ring_width;
        }
        let y = (ring_width + fontsize) / 2;
        for (let mount in this.mounts) {
            var text = this.mounts[mount];
            if (text.length > 10) {
                text = text.split('/').pop();
            }
            cr.moveTo(0, y);
            cr.showText(text);
            y += ring_width;
        }
        cr.$dispose();
    }

    update_mounts(mounts) {
        this.mounts = mounts;
        this.actor.queue_repaint();
    }
}

var TipItem = null;

if (shell_Version < '3.36') {
    TipItem = class SystemMonitor_TipItem extends PopupMenu.PopupBaseMenuItem {
        constructor() {
            super();
            // PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
            this.actor.remove_style_class_name('popup-menu-item');
            this.actor.add_style_class_name('sm-tooltip-item');
        }
    }
} else {
    TipItem = GObject.registerClass(
        {
            GTypeName: 'TipItem'
        },
        class SystemMonitor_TipItem extends PopupMenu.PopupBaseMenuItem {
            _init() {
                super._init();
                // PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
                this.actor.remove_style_class_name('popup-menu-item');
                this.actor.add_style_class_name('sm-tooltip-item');
            }
        }
    );
}
const TipMenu = class SystemMonitor_TipMenu extends PopupMenu.PopupMenuBase {
    constructor(sourceActor) {
        // PopupMenu.PopupMenuBase.prototype._init.call(this, sourceActor, 'sm-tooltip-box');
        super(sourceActor, 'sm-tooltip-box');
        this.actor = new Clutter.Actor();
        // this.actor.connect('get-preferred-width',
        //     this._boxGetPreferredWidth).bind(this);
        // this.actor.connect('get-preferred-height',
        //     this._boxGetPreferredHeight.bind(this));
        this.actor.add_actor(this.box);
    }
    // _boxGetPreferredWidth (actor, forHeight, alloc) {
    //     // let columnWidths = this.getColumnWidths();
    //     // this.setColumnWidths(columnWidths);
    //
    //     [alloc.min_size, alloc.natural_size] = this.box.get_preferred_width(forHeight);
    // }
    // _boxGetPreferredHeight (actor, forWidth, alloc) {
    //     [alloc.min_size, alloc.natural_size] = this.box.get_preferred_height(forWidth);
    // }
    // _boxAllocate (actor, box, flags) {
    //     this.box.allocate(box, flags);
    // }
    _shift() {
        // Probably old but works
        let node = this.sourceActor.get_theme_node();
        let contentbox = node.get_content_box(this.sourceActor.get_allocation_box());

        let sourceTopLeftX = 0;
        let sourceTopLeftY = 0;
        if (typeof this.sourceActor.get_transformed_extents === 'function') {
            let extents = this.sourceActor.get_transformed_extents();
            let sourceTopLeft = extents.get_top_left();
            sourceTopLeftY = sourceTopLeft.y;
            sourceTopLeftX = sourceTopLeft.x;
        } else {
            let allocation = Shell.util_get_transformed_allocation(this.sourceActor);
            sourceTopLeftY = allocation.y1;
            sourceTopLeftX = allocation.x1;
        }
        let monitor = Main.layoutManager.findMonitorForActor(this.sourceActor);
        let [x, y] = [sourceTopLeftX + contentbox.x1,
            sourceTopLeftY + contentbox.y1];
        let [cx, cy] = [sourceTopLeftX + (contentbox.x1 + contentbox.x2) / 2,
            sourceTopLeftY + (contentbox.y1 + contentbox.y2) / 2];
        let [xm, ym] = [sourceTopLeftX + contentbox.x2,
            sourceTopLeftY + contentbox.y2];
        let [width, height] = this.actor.get_size();
        let tipx = cx - width / 2;
        tipx = Math.max(tipx, monitor.x);
        tipx = Math.min(tipx, monitor.x + monitor.width - width);
        let tipy = Math.floor(ym);
        // Hacky condition to determine if the status bar is at the top or at the bottom of the screen
        if (sourceTopLeftY / monitor.height > 0.3) {
            tipy = sourceTopLeftY - height; // If it is at the bottom, place the tooltip above instead of below
        }
        this.actor.set_position(tipx, tipy);
    }
    open(animate) {
        if (this.isOpen) {
            return;
        }

        this.isOpen = true;
        this.actor.show();
        this._shift();
        this.actor.raise_top();
        this.emit('open-state-changed', true);
    }
    close(animate) {
        this.isOpen = false;
        this.actor.hide();
        this.emit('open-state-changed', false);
    }
}

const TipBox = class SystemMonitor_TipBox {
    constructor() {
        this.actor = new St.BoxLayout({reactive: true});
        this.actor._delegate = this;
        this.set_tip(new TipMenu(this.actor));
        this.in_to = this.out_to = 0;
        this.actor.connect('enter-event', this.on_enter.bind(this));
        this.actor.connect('leave-event', this.on_leave.bind(this));
    }
    set_tip(tipmenu) {
        if (this.tipmenu) {
            this.tipmenu.destroy();
        }
        this.tipmenu = tipmenu;
        if (this.tipmenu) {
            Main.uiGroup.add_actor(this.tipmenu.actor);
            this.hide_tip();
        }
    }
    show_tip() {
        if (!this.tipmenu) {
            return;
        }
        this.tipmenu.open();
        if (this.in_to) {
            Mainloop.source_remove(this.in_to);
            this.in_to = 0;
        }
    }
    hide_tip() {
        if (!this.tipmenu) {
            return;
        }
        this.tipmenu.close();
        if (this.out_to) {
            Mainloop.source_remove(this.out_to);
            this.out_to = 0;
        }
        if (this.in_to) {
            Mainloop.source_remove(this.in_to);
            this.in_to = 0;
        }
    }
    on_enter() {
        let show_tooltip = Schema.get_boolean('show-tooltip');

        if (!show_tooltip) {
            return;
        }

        if (this.out_to) {
            Mainloop.source_remove(this.out_to);
            this.out_to = 0;
        }
        if (!this.in_to) {
            this.in_to = Mainloop.timeout_add(500,
                this.show_tip.bind(this));
        }
    }
    on_leave() {
        if (this.in_to) {
            Mainloop.source_remove(this.in_to);
            this.in_to = 0;
        }
        if (!this.out_to) {
            this.out_to = Mainloop.timeout_add(500,
                this.hide_tip.bind(this));
        }
    }
    destroy() {
        if (this.in_to) {
            Mainloop.source_remove(this.in_to);
            this.in_to = 0;
        }

        if (this.out_to) {
            Mainloop.source_remove(this.out_to);
            this.out_to = 0;
        }

        this.actor.destroy();
    }
}

const ElementBase = class SystemMonitor_ElementBase extends TipBox {
    constructor(properties) {
        super();
        this.elt = '';
        this.item_name = _('');
        this.color_name = [];
        this.text_items = [];
        this.menu_items = [];
        this.menu_visible = true;

        Object.assign(this, properties);

        //            TipBox.prototype._init.apply(this, arguments);
        this.vals = [];
        this.tip_labels = [];
        this.tip_vals = [];
        this.tip_unit_labels = [];

        this.colors = [];
        for (let color in this.color_name) {
            let name = this.elt + '-' + this.color_name[color] + '-color';
            let clutterColor = color_from_string(Schema.get_string(name));
            Schema.connect('changed::' + name, (schema, key) => {
                this.clutterColor = color_from_string(Schema.get_string(key));
            });
            Schema.connect('changed::' + name, () => {
                this.chart.actor.queue_repaint();
            });
            this.colors.push(clutterColor);
        }

        let element_width = Schema.get_int(this.elt + '-graph-width');
        if (Style.get('') === '-compact') {
            element_width = Math.round(element_width / 1.5);
        }
        this.chart = new Chart(element_width, IconSize, this);

        Schema.connect('changed::background', () => {
            this.chart.actor.queue_repaint();
        });

        this.actor.visible = Schema.get_boolean(this.elt + '-display');
        Schema.connect(
            'changed::' + this.elt + '-display', (schema, key) => {
                this.actor.visible = Schema.get_boolean(key);
            });

        this.interval = l_limit(Schema.get_int(this.elt + '-refresh-time'));
        this.timeout = Mainloop.timeout_add(
            this.interval,
            this.update.bind(this),
            GLib.PRIORITY_DEFAULT_IDLE
        );

        Schema.connect(
            'changed::' + this.elt + '-refresh-time',
            (schema, key) => {
                Mainloop.source_remove(this.timeout);
                this.timeout = null;
                this.interval = l_limit(Schema.get_int(key));
                this.timeout = Mainloop.timeout_add(
                    this.interval, this.update.bind(this), GLib.PRIORITY_DEFAULT_IDLE);
            });
        Schema.connect('changed::' + this.elt + '-graph-width', this.resize.bind(this));

        if (this.elt === 'thermal') {
            Schema.connect('changed::thermal-threshold',
                () => {
                    Mainloop.source_remove(this.timeout);
                    this.timeout = null;
                    this.reset_style();
                    this.timeout = Mainloop.timeout_add(
                        this.interval, this.update.bind(this), GLib.PRIORITY_DEFAULT_IDLE);
                });
        }

        this.label = new St.Label({text: this.elt === 'memory' ? _('mem') : _(this.elt),
            style_class: Style.get('sm-status-label')});
        change_text.call(this);
        Schema.connect('changed::' + this.elt + '-show-text', change_text.bind(this));

        this.menu_visible = Schema.get_boolean(this.elt + '-show-menu');
        Schema.connect('changed::' + this.elt + '-show-menu', change_menu.bind(this));

        this.actor.add_actor(this.label);
        this.text_box = new St.BoxLayout();

        this.actor.add_actor(this.text_box);
        this.text_items = this.create_text_items();
        for (let item in this.text_items) {
            this.text_box.add_actor(this.text_items[item]);
        }
        this.actor.add_actor(this.chart.actor);
        change_style.call(this);
        Schema.connect('changed::' + this.elt + '-style', change_style.bind(this));
        this.menu_items = this.create_menu_items();
    }
    tip_format(unit) {
        if (typeof (unit) === 'undefined') {
            unit = '%';
        }
        if (typeof (unit) === 'string') {
            let all_unit = unit;
            unit = [];
            for (let i = 0; i < this.color_name.length; i++) {
                unit.push(all_unit);
            }
        }
        for (let i = 0; i < this.color_name.length; i++) {
            let tipline = new TipItem();
            this.tipmenu.addMenuItem(tipline);
            tipline.actor.add(new St.Label({text: _(this.color_name[i])}));
            this.tip_labels[i] = new St.Label({text: ''});
            tipline.actor.add(this.tip_labels[i]);

            this.tip_unit_labels[i] = new St.Label({text: unit[i]});
            tipline.actor.add(this.tip_unit_labels[i]);
            this.tip_vals[i] = 0;
        }
    }
    //        set_tip_unit: function(unit) {
    //           for (let i = 0;i < this.tip_unit_labels.length;i++) {
    //           this.tip_unit_labels[i].text = unit[i];
    //           }
    //           }
    update() {
        if (!this.menu_visible && !this.actor.visible) {
            return false;
        }
        this.refresh();
        this._apply();
        if (this.elt === 'thermal') {
            this.threshold();
        }
        this.chart.update();
        for (let i = 0; i < this.tip_vals.length; i++) {
            if (this.tip_labels[i]) {
                this.tip_labels[i].text = this.tip_vals[i].toString();
            }
        }
        return true;
    }
    reset_style() {
        this.text_items[0].set_style('color: rgba(255, 255, 255, 1)');
    }
    threshold() {
        if (Schema.get_int('thermal-threshold')) {
            if (this.temp_over_threshold) {
                this.text_items[0].set_style('color: rgba(255, 0, 0, 1)');
            } else {
                this.text_items[0].set_style('color: rgba(255, 255, 255, 1)');
            }
        }
    }
    resize(schema, key) {
        let width = Schema.get_int(key);
        if (Style.get('') === '-compact') {
            width = Math.round(width / 1.5);
        }
        this.chart.resize(width);
    }
    destroy() {
        TipBox.prototype.destroy.call(this);
        if (this.timeout) {
            Mainloop.source_remove(this.timeout);
            this.timeout = null;
        }
    }
}

const Battery = class SystemMonitor_Battery extends ElementBase {
    constructor() {
        super({
            elt: 'battery',
            item_name: _('Battery'),
            color_name: ['batt0'],
            icon: '. GThemedIcon battery-good-symbolic battery-good'
        });

        this.max = 100;
        this.icon_hidden = false;
        this.percentage = 0;
        this.timeString = '-- ';
        if (shell_Version => '43') {
            this._proxy = StatusArea.quickSettings._system._systemItem._powerToggle._proxy;
        } else {
            this._proxy = StatusArea.aggregateMenu._power._proxy;
        }
        if (typeof (this._proxy) === 'undefined') {
            this._proxy = StatusArea.battery._proxy;
        }
        this.powerSigID = this._proxy.connect('g-properties-changed', this.update_battery.bind(this));

        // need to specify a default icon, since the contructor completes before UPower callback
        this.gicon = Gio.icon_new_for_string(this.icon);

        this.tip_format('%');

        this.update_battery();
        this.update_tips();
        // this.hide_system_icon();
        this.update();

        // Schema.connect('changed::' + this.elt + '-hidesystem', this.hide_system_icon.bind(this));
        Schema.connect('changed::' + this.elt + '-time', this.update_tips.bind(this));
    }
    refresh() {
        // do nothing here?
    }
    update_battery() {
        // callback function for when battery stats updated.
        let battery_found = false;
        let isBattery = false;
        if (typeof (this._proxy.GetDevicesRemote) === 'undefined') {
            let device_type = this._proxy.Type;
            isBattery = (device_type === UPower.DeviceKind.BATTERY);
            if (isBattery) {
                battery_found = true;
                let icon = this._proxy.IconName;
                let percentage = this._proxy.Percentage;
                let seconds = this._proxy.TimeToEmpty;
                this.update_battery_value(seconds, percentage, icon);
            } else {
                // log("[System monitor] No battery found");
                this.actor.hide();
                this.menu_visible = false;
                build_menu_info();
            }
        } else {
            this._proxy.GetDevicesRemote((devices, error) => {
                if (error) {
                    log('[System monitor] Power proxy error: ' + error);
                    this.actor.hide();
                    this.menu_visible = false;
                    build_menu_info();
                    return;
                }

                let [result] = devices;
                for (let i = 0; i < result.length; i++) {
                    let [device_id, device_type, icon, percentage, state, seconds] = result[i];

                    isBattery = (device_type === UPower.DeviceKind.BATTERY);
                    if (isBattery) {
                        battery_found = true;
                        this.update_battery_value(seconds, percentage, icon);
                        break;
                    }
                }

                if (!battery_found) {
                    // log("[System monitor] No battery found");
                    this.actor.hide();
                    this.menu_visible = false;
                    build_menu_info();
                }
            });
        }
    }
    update_battery_value(seconds, percentage, icon) {
        if (seconds > 60) {
            let time = Math.round(seconds / 60);
            let minutes = time % 60;
            let hours = Math.floor(time / 60);
            this.timeString = C_('battery time remaining', '%d:%02d').format(hours, minutes);
        } else {
            this.timeString = '-- ';
        }
        this.percentage = Math.ceil(percentage);
        this.gicon = Gio.icon_new_for_string(icon);

        if (Schema.get_boolean(this.elt + '-display')) {
            this.actor.show()
        }
        if (Schema.get_boolean(this.elt + '-show-menu') && !this.menu_visible) {
            this.menu_visible = true;
            build_menu_info();
        }
    }
    hide_system_icon(override) {
        let value = Schema.get_boolean(this.elt + '-hidesystem');
        if (!override) {
            value = false;
        }
        if (value && Schema.get_boolean(this.elt + '-display')) {
            if (shell_Version > '3.5') {
                if (StatusArea.battery.actor.visible) {
                    StatusArea.battery.destroy();
                    this.icon_hidden = true;
                }
            } else {
                for (let Index = 0; Index < Main.panel._rightBox.get_children().length; Index++) {
                    if (StatusArea.battery === Main.panel._rightBox.get_children()[Index]._delegate) {
                        Main.panel._rightBox.get_children()[Index].destroy();
                        StatusArea.battery = null;
                        this.icon_hidden = true;
                        break;
                    }
                }
            }
        } else if (this.icon_hidden) {
            if (shell_Version < '3.5') {
                let Indicator = new Panel.STANDARD_STATUS_AREA_SHELL_IMPLEMENTATION.battery();
                Main.panel.addToStatusArea('battery', Indicator, Panel.STANDARD_STATUS_AREA_ORDER.indexOf('battery'));
            } else {
                let Indicator = new Panel.PANEL_ITEM_IMPLEMENTATIONS.battery();
                Main.panel.addToStatusArea('battery', Indicator, Main.sessionMode.panel.right.indexOf('battery'), 'right');
            }
            this.icon_hidden = false;
            // Main.panel._updatePanel('right');
        }
    }
    get_battery_unit() {
        let unitString;
        let value = Schema.get_boolean(this.elt + '-time');

        if (value) {
            unitString = 'h';
        } else {
            unitString = '%';
        }

        return unitString;
    }
    update_tips() {
        let unitString = this.get_battery_unit();

        if (Schema.get_boolean(this.elt + '-display')) {
            this.text_items[2].text = unitString;
        }
        if (Schema.get_boolean(this.elt + '-show-menu')) {
            this.menu_items[1].text = unitString;
        }

        this.update();
    }
    _apply() {
        let displayString;
        let value = Schema.get_boolean(this.elt + '-time');
        if (value) {
            displayString = this.timeString;
        } else {
            displayString = this.percentage.toString()
        }
        if (Schema.get_boolean(this.elt + '-display')) {
            this.text_items[0].gicon = this.gicon;
            this.text_items[1].text = displayString;
        }
        if (Schema.get_boolean(this.elt + '-show-menu')) {
            this.menu_items[0].text = displayString;
        }
        this.vals = [this.percentage];
        this.tip_vals[0] = Math.round(this.percentage);
    }
    create_text_items() {
        return [
            new St.Icon({
                gicon: Gio.icon_new_for_string(this.icon),
                style_class: Style.get('sm-status-icon')}),
            new St.Label({
                text: '',
                style_class: Style.get('sm-status-value'),
                y_align: Clutter.ActorAlign.CENTER}),
            new St.Label({
                text: this.get_battery_unit(),
                style_class: Style.get('sm-perc-label'),
                y_align: Clutter.ActorAlign.CENTER})
        ];
    }
    create_menu_items() {
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-value')}),
            new St.Label({
                text: this.get_battery_unit(),
                style_class: Style.get('sm-label')})
        ];
    }
    destroy() {
        ElementBase.prototype.destroy.call(this);
        this._proxy.disconnect(this.powerSigID);
    }
}

const Cpu = class SystemMonitor_Cpu extends ElementBase {
    constructor(cpuid) {
        super({
            elt: 'cpu',
            item_name: _('CPU'),
            color_name: ['user', 'system', 'nice', 'iowait', 'other'],
            cpuid: -1 // cpuid is -1 when all cores are displayed in the same graph
        });
        this.max = 100;

        this.cpuid = cpuid;
        this.gtop = new GTop.glibtop_cpu();
        this.last = [0, 0, 0, 0, 0];
        this.current = [0, 0, 0, 0, 0];
        try {
            this.total_cores = GTop.glibtop_get_sysinfo().ncpu;
            if (cpuid === -1) {
                this.max *= this.total_cores;
            }
        } catch (e) {
            this.total_cores = this.get_cores();
            global.logError(e)
        }
        this.last_total = 0;
        this.usage = [0, 0, 0, 1, 0];
        this.item_name = _('Cpu');
        if (cpuid !== -1) {
            this.item_name += ' ' + (cpuid + 1);
        } // append cpu number to cpu name in popup
        // ElementBase.prototype._init.call(this);
        this.tip_format();
        this.update();
    }
    refresh() {
        GTop.glibtop_get_cpu(this.gtop);
        // display global cpu usage on 1 graph
        if (this.cpuid === -1) {
            this.current[0] = this.gtop.user;
            this.current[1] = this.gtop.sys;
            this.current[2] = this.gtop.nice;
            this.current[3] = this.gtop.idle;
            this.current[4] = this.gtop.iowait;
            let delta = (this.gtop.total - this.last_total) / (100 * this.total_cores);

            if (delta > 0) {
                for (let i = 0; i < 5; i++) {
                    this.usage[i] = Math.round((this.current[i] - this.last[i]) / delta);
                    this.last[i] = this.current[i];
                }
                this.last_total = this.gtop.total;
            } else if (delta < 0) {
                this.last = [0, 0, 0, 0, 0];
                this.current = [0, 0, 0, 0, 0];
                this.last_total = 0;
                this.usage = [0, 0, 0, 1, 0];
            }
        } else {
            // display per cpu data
            this.current[0] = this.gtop.xcpu_user[this.cpuid];
            this.current[1] = this.gtop.xcpu_sys[this.cpuid];
            this.current[2] = this.gtop.xcpu_nice[this.cpuid];
            this.current[3] = this.gtop.xcpu_idle[this.cpuid];
            this.current[4] = this.gtop.xcpu_iowait[this.cpuid];
            let delta = (this.gtop.xcpu_total[this.cpuid] - this.last_total) / 100;

            if (delta > 0) {
                for (let i = 0; i < 5; i++) {
                    this.usage[i] = Math.round((this.current[i] - this.last[i]) / delta);
                    this.last[i] = this.current[i];
                }
                this.last_total = this.gtop.xcpu_total[this.cpuid];
            } else if (delta < 0) {
                this.last = [0, 0, 0, 0, 0];
                this.current = [0, 0, 0, 0, 0];
                this.last_total = 0;
                this.usage = [0, 0, 0, 1, 0];
            }
        }

        // GTop.glibtop_get_cpu(this.gtop);
        // // display global cpu usage on 1 graph
        // if (this.cpuid == -1) {
        //     this.current[0] = this.gtop.user;
        //     this.current[1] = this.gtop.sys;
        //     this.current[2] = this.gtop.nice;
        //     this.current[3] = this.gtop.idle;
        //     this.current[4] = this.gtop.iowait;
        // } else {
        //     // display cpu usage for given core
        //     this.current[0] = this.gtop.xcpu_user[this.cpuid];
        //     this.current[1] = this.gtop.xcpu_sys[this.cpuid];
        //     this.current[2] = this.gtop.xcpu_nice[this.cpuid];
        //     this.current[3] = this.gtop.xcpu_idle[this.cpuid];
        //     this.current[4] = this.gtop.xcpu_iowait[this.cpuid];
        // }
        //
        // let delta = 0;
        // if (this.cpuid == -1)
        //     delta = (this.gtop.total - this.last_total)/(100*this.total_cores);
        // else
        //     delta = (this.gtop.xcpu_total[this.cpuid] - this.last_total)/100;
        //
        // if (delta > 0) {
        //     for (let i = 0;i < 5;i++) {
        //         this.usage[i] = Math.round((this.current[i] - this.last[i])/delta);
        //         this.last[i] = this.current[i];
        //     }
        //     if (this.cpuid == -1)
        //         this.last_total = this.gtop.total;
        //     else
        //         this.last_total = this.gtop.xcpu_total[this.cpuid];
        // }
    }
    _apply() {
        let percent = 0;
        if (this.cpuid === -1) {
            percent = Math.round(((100 * this.total_cores) - this.usage[3]) /
                                 this.total_cores);
        } else {
            percent = Math.round((100 - this.usage[3]));
        }

        this.text_items[0].text = this.menu_items[0].text = percent.toString();
        let other = 100;
        for (let i = 0; i < this.usage.length; i++) {
            other -= this.usage[i];
        }
        // Not to be confusing
        other = Math.max(0, other);
        this.vals = [this.usage[0], this.usage[1],
            this.usage[2], this.usage[4], other];
        for (let i = 0; i < 5; i++) {
            this.tip_vals[i] = Math.round(this.vals[i]);
        }
    }

    get_cores() {
        // Getting xcpu_total makes gjs 1.29.18 segfault
        // let cores = 0;
        // GTop.glibtop_get_cpu(this.gtop);
        // let gtop_total = this.gtop.xcpu_total
        // for (let i = 0; i < gtop_total.length;i++) {
        //     if (gtop_total[i] > 0)
        //         cores++;
        // }
        // return cores;
        return 1;
    }
    create_text_items() {
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-status-value'),
                y_align: Clutter.ActorAlign.CENTER}),
            new St.Label({
                text: '%', style_class: Style.get('sm-perc-label'),
                y_align: Clutter.ActorAlign.CENTER})
        ];
    }
    create_menu_items() {
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-value')}),
            new St.Label({
                text: '%',
                style_class: Style.get('sm-label')})
        ];
    }
}

// Check if one graph per core must be displayed and create the
//    appropriate number of cpu items
function createCpus() {
    let array = [];
    let numcores = 1;

    if (Schema.get_boolean('cpu-individual-cores')) {
        // get number of cores
        let gtop = new GTop.glibtop_cpu();
        try {
            numcores = GTop.glibtop_get_sysinfo().ncpu;
        } catch (e) {
            global.logError(e);
            numcores = 1;
        }
    }

    // there are several cores to display,
    // instantiate each cpu
    if (numcores > 1) {
        for (let i = 0; i < numcores; i++) {
            array.push(new Cpu(i));
        }
    } else {
        // individual cores option is not set or we failed to
        // get the number of cores, create a global cpu item
        array.push(new Cpu(-1));
    }

    return array;
}

const Disk = class SystemMonitor_Disk extends ElementBase {
    constructor() {
        super({
            elt: 'disk',
            item_name: _('Disk'),
            color_name: ['read', 'write']
        });
        this.mounts = MountsMonitor.get_mounts();
        MountsMonitor.add_listener(this.update_mounts.bind(this));
        this.last = [0, 0];
        this.usage = [0, 0];
        this.last_time = 0;
        this.tip_format(_('MiB/s'));
        this.update();
    }
    update_mounts(mounts) {
        this.mounts = mounts;
    }
    refresh() {
        let accum = [0, 0];

        let file = Gio.file_new_for_path('/proc/diskstats');
        file.load_contents_async(null, (source, result) => {
            let as_r = source.load_contents_finish(result);
            let lines = parse_bytearray(as_r[1]).toString().split('\n');

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                let entry = line.trim().split(/[\s]+/);
                if (typeof (entry[1]) === 'undefined') {
                    break;
                }
                accum[0] += parseInt(entry[5]);
                accum[1] += parseInt(entry[9]);
            }

            let time = GLib.get_monotonic_time() / 1000;
            let delta = (time - this.last_time) / 1000;
            if (delta > 0) {
                for (let i = 0; i < 2; i++) {
                    this.usage[i] = ((accum[i] - this.last[i]) / delta / 1024 / 8);
                    this.last[i] = accum[i];
                }
            }
            this.last_time = time;
        });
    }
    _apply() {
        this.vals = this.usage.slice();
        for (let i = 0; i < 2; i++) {
            if (this.usage[i] < 10) {
                this.usage[i] = Math.round(10 * this.usage[i]) / 10;
            } else {
                this.usage[i] = Math.round(this.usage[i]);
            }
        }
        this.tip_vals = [this.usage[0], this.usage[1]];
        this.menu_items[0].text = this.text_items[1].text = this.tip_vals[0].toLocaleString(Locale);
        this.menu_items[3].text = this.text_items[4].text = this.tip_vals[1].toLocaleString(Locale);
    }
    create_text_items() {
        return [
            new St.Label({
                text: _('R'),
                style_class: Style.get('sm-status-label')}),
            new St.Label({
                text: '',
                style_class: Style.get('sm-disk-value'),
                y_align: Clutter.ActorAlign.CENTER}),
            new St.Label({
                text: Style.diskunits(),
                style_class: Style.get('sm-disk-unit-label'),
                y_align: Clutter.ActorAlign.CENTER}),
            new St.Label({
                text: _('W'),
                style_class: Style.get('sm-status-label')}),
            new St.Label({
                text: '',
                style_class: Style.get('sm-disk-value'),
                y_align: Clutter.ActorAlign.CENTER}),
            new St.Label({
                text: Style.diskunits(),
                style_class: Style.get('sm-disk-unit-label'),
                y_align: Clutter.ActorAlign.CENTER})
        ];
    }
    create_menu_items() {
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-value')}),
            new St.Label({
                text: Style.diskunits(),
                style_class: Style.get('sm-label')}),
            new St.Label({
                text: _('R'),
                style_class: Style.get('sm-label')}),
            new St.Label({
                text: '',
                style_class: Style.get('sm-value')}),
            new St.Label({
                text: Style.diskunits(),
                style_class: Style.get('sm-label')}),
            new St.Label({
                text: ' ' + _('W'),
                style_class: Style.get('sm-label')})
        ];
    }
}

const Freq = class SystemMonitor_Freq extends ElementBase {
    constructor() {
        super({
            elt: 'freq',
            item_name: _('Freq'),
            color_name: ['freq']
        });
        this.freq = 0;
        this.tip_format('MHz');
        this.update();
    }
    refresh() {
        let total_frequency = 0;
        let num_cpus = GTop.glibtop_get_sysinfo().ncpu;
        let i = 0;
        let file = Gio.file_new_for_path(`/sys/devices/system/cpu/cpu${i}/cpufreq/scaling_cur_freq`);
        var that = this;
        file.load_contents_async(null, function cb(source, result) {
            let as_r = source.load_contents_finish(result);
            total_frequency += parseInt(parse_bytearray(as_r[1]));

            if (++i >= num_cpus) {
                that.freq = Math.round(total_frequency / num_cpus / 1000);
            } else {
                file = Gio.file_new_for_path(`/sys/devices/system/cpu/cpu${i}/cpufreq/scaling_cur_freq`);
                file.load_contents_async(null, cb.bind(that));
            }
        });
    }
    _apply() {
        let value = this.freq.toString();
        this.text_items[0].text = value + ' ';
        this.vals[0] = value;
        this.tip_vals[0] = value;
        if (Style.get('') !== '-compact') {
            this.menu_items[0].text = value;
        } else {
            this.menu_items[0].text = this._pad(value, 4);
        }
    }
    // pad a string with leading spaces
    _pad(number, length) {
        var str = '' + number;
        while (str.length < length) {
            str = ' ' + str;
        }
        return str;
    }
    create_text_items() {
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-big-status-value'),
                y_align: Clutter.ActorAlign.CENTER}),
            new St.Label({
                text: 'MHz', style_class: Style.get('sm-perc-label'),
                y_align: Clutter.ActorAlign.CENTER})
        ];
    }
    create_menu_items() {
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-value')}),
            new St.Label({
                text: 'MHz',
                style_class: Style.get('sm-label')})
        ];
    }
}

const Mem = class SystemMonitor_Mem extends ElementBase {
    constructor() {
        super({
            elt: 'memory',
            item_name: _('Memory'),
            color_name: ['program', 'buffer', 'cache']
        });
        this.max = 1;

        this.gtop = new GTop.glibtop_mem();
        this.mem = [0, 0, 0];

        GTop.glibtop_get_mem(this.gtop);
        this.total = Math.round(this.gtop.total / 1024 / 1024);
        let threshold = 4 * 1024; // In MiB
        this.useGiB = false;
        this._unitConversion = 1024 * 1024;
        this._decimals = 100;
        if (this.total > threshold) {
            this.useGiB = true;
            this._unitConversion *= 1024 / this._decimals;
        }

        this.tip_format();
        this.update();
    }
    refresh() {
        GTop.glibtop_get_mem(this.gtop);
        if (this.useGiB) {
            this.mem[0] = Math.round(this.gtop.user / this._unitConversion);
            this.mem[0] /= this._decimals;
            this.mem[1] = Math.round(this.gtop.buffer / this._unitConversion);
            this.mem[1] /= this._decimals;
            this.mem[2] = Math.round(this.gtop.cached / this._unitConversion);
            this.mem[2] /= this._decimals;
            this.total = Math.round(this.gtop.total / this._unitConversion);
            this.total /= this._decimals;
        } else {
            this.mem[0] = Math.round(this.gtop.user / this._unitConversion);
            this.mem[1] = Math.round(this.gtop.buffer / this._unitConversion);
            this.mem[2] = Math.round(this.gtop.cached / this._unitConversion);
            this.total = Math.round(this.gtop.total / this._unitConversion);
        }
    }
    _pad(number) {
        if (this.useGiB) {
            if (number < 1) {
                // examples: 0.01, 0.10, 0.88
                return number.toLocaleString(Locale, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            }
            // examples: 5.85, 16.0, 128
            return number.toLocaleString(Locale, {minimumSignificantDigits: 3, maximumSignificantDigits: 3});
        }

        return number.toLocaleString(Locale);
    }
    _apply() {
        if (this.total === 0) {
            this.vals = this.tip_vals = [0, 0, 0];
        } else {
            for (let i = 0; i < 3; i++) {
                this.vals[i] = this.mem[i] / this.total;
                this.tip_vals[i] = Math.round(this.vals[i] * 100);
            }
        }
        this.text_items[0].text = this.tip_vals[0].toString();
        this.menu_items[0].text = this.tip_vals[0].toLocaleString(Locale);
        if (Style.get('') !== '-compact') {
            this.menu_items[3].text = this._pad(this.mem[0]) +
                ' / ' + this._pad(this.total);
        } else {
            this.menu_items[3].text = this._pad(this.mem[0]) +
                '/' + this._pad(this.total);
        }
    }
    create_text_items() {
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-status-value'),
                y_align: Clutter.ActorAlign.CENTER}),
            new St.Label({
                text: '%', style_class: Style.get('sm-perc-label'),
                y_align: Clutter.ActorAlign.CENTER})
        ];
    }
    create_menu_items() {
        let unit = _('MiB');
        if (this.useGiB) {
            unit = _('GiB');
        }
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-value')}),
            new St.Label({
                text: '%',
                style_class: Style.get('sm-label')}),
            new St.Label({
                text: '',
                style_class: Style.get('sm-label')}),
            new St.Label({
                text: '',
                style_class: Style.get('sm-value')}),
            new St.Label({text: unit,
                style_class: Style.get('sm-label')})
        ];
    }
}

const Net = class SystemMonitor_Net extends ElementBase {
    constructor() {
        super({
            elt: 'net',
            item_name: _('Net'),
            color_name: ['down', 'downerrors', 'up', 'uperrors', 'collisions']
        });
        this.speed_in_bits = false;
        this.ifs = [];
        this.client = libnm_glib ? NM.Client.new() : NM.Client.new(null);
        this.update_iface_list();

        if (!this.ifs.length) {
            let net_lines = Shell.get_file_contents_utf8_sync('/proc/net/dev').split('\n');
            for (let i = 2; i < net_lines.length - 1; i++) {
                let ifc = net_lines[i].replace(/^\s+/g, '').split(':')[0];
                if (Shell.get_file_contents_utf8_sync('/sys/class/net/' + ifc + '/operstate')
                    .replace(/\s/g, '') === 'up' &&
                    ifc.indexOf('br') < 0 &&
                    ifc.indexOf('lo') < 0) {
                    this.ifs.push(ifc);
                }
            }
        }
        this.gtop = new GTop.glibtop_netload();
        this.last = [0, 0, 0, 0, 0];
        this.usage = [0, 0, 0, 0, 0];
        this.last_time = 0;
        this.tip_format([_('KiB/s'), '/s', _('KiB/s'), '/s', '/s']);
        this.update_units();
        Schema.connect('changed::' + this.elt + '-speed-in-bits', this.update_units.bind(this));
        try {
            let iface_list = this.client.get_devices();
            this.NMsigID = [];
            for (let j = 0; j < iface_list.length; j++) {
                this.NMsigID[j] = iface_list[j].connect('state-changed', this.update_iface_list.bind(this));
            }
        } catch (e) {
            global.logError('Please install Network Manager Gobject Introspection Bindings: ' + e);
        }
        this.update();
    }
    update_units() {
        this.speed_in_bits = Schema.get_boolean(this.elt + '-speed-in-bits');
    }
    update_iface_list() {
        try {
            this.ifs = [];
            let iface_list = this.client.get_devices();
            for (let j = 0; j < iface_list.length; j++) {
                if (iface_list[j].state === NetworkManager.DeviceState.ACTIVATED) {
                    this.ifs.push(iface_list[j].get_ip_iface() || iface_list[j].get_iface());
                }
            }
        } catch (e) {
            global.logError('Please install Network Manager Gobject Introspection Bindings');
        }
    }
    refresh() {
        let accum = [0, 0, 0, 0, 0];

        for (let ifn in this.ifs) {
            GTop.glibtop_get_netload(this.gtop, this.ifs[ifn]);
            accum[0] += this.gtop.bytes_in;
            accum[1] += this.gtop.errors_in;
            accum[2] += this.gtop.bytes_out;
            accum[3] += this.gtop.errors_out;
            accum[4] += this.gtop.collisions;
        }

        let time = GLib.get_monotonic_time() * 0.001024;
        let delta = time - this.last_time;
        if (delta > 0) {
            for (let i = 0; i < 5; i++) {
                this.usage[i] = Math.round((accum[i] - this.last[i]) / delta);
                this.last[i] = accum[i];
                this.vals[i] = this.usage[i];
            }
        }
        this.last_time = time;
    }

    // pad a string with leading spaces
    _pad(number, length) {
        var str = '' + number;
        while (str.length < length) {
            str = ' ' + str;
        }
        return str;
    }

    _apply() {
        this.tip_vals = this.usage;
        if (this.speed_in_bits) {
            this.tip_vals[0] = Math.round(this.tip_vals[0] * 8.192);
            this.tip_vals[2] = Math.round(this.tip_vals[2] * 8.192);
            if (this.tip_vals[0] < 1000) {
                this.text_items[2].text = Style.netunits_kbits();
                this.menu_items[1].text = this.tip_unit_labels[0].text = _('kbit/s');
            } else if (this.tip_vals[0] < 1000000) {
                this.text_items[2].text = Style.netunits_mbits();
                this.menu_items[1].text = this.tip_unit_labels[0].text = _('Mbit/s');
                this.tip_vals[0] = (this.tip_vals[0] / 1000).toPrecision(3);
            } else {
                this.text_items[2].text = Style.netunits_gbits();
                this.menu_items[1].text = this.tip_unit_labels[0].text = _('Gbit/s');
                this.tip_vals[0] = (this.tip_vals[0] / 1000000).toPrecision(3);
            }
            if (this.tip_vals[2] < 1000) {
                this.text_items[5].text = Style.netunits_kbits();
                this.menu_items[4].text = this.tip_unit_labels[2].text = _('kbit/s');
            } else if (this.tip_vals[2] < 1000000) {
                this.text_items[5].text = Style.netunits_mbits();
                this.menu_items[4].text = this.tip_unit_labels[2].text = _('Mbit/s');
                this.tip_vals[2] = (this.tip_vals[2] / 1000).toPrecision(3);
            } else {
                this.text_items[5].text = Style.netunits_gbits();
                this.menu_items[4].text = this.tip_unit_labels[2].text = _('Gbit/s');
                this.tip_vals[2] = (this.tip_vals[2] / 1000000).toPrecision(3);
            }
        } else {
            if (this.tip_vals[0] < 1024) {
                this.text_items[2].text = Style.netunits_kbytes();
                this.menu_items[1].text = this.tip_unit_labels[0].text = _('KiB/s');
            } else if (this.tip_vals[0] < 1048576) {
                this.text_items[2].text = Style.netunits_mbytes();
                this.menu_items[1].text = this.tip_unit_labels[0].text = _('MiB/s');
                this.tip_vals[0] = (this.tip_vals[0] / 1024).toPrecision(3);
            } else {
                this.text_items[2].text = Style.netunits_gbytes();
                this.menu_items[1].text = this.tip_unit_labels[0].text = _('GiB/s');
                this.tip_vals[0] = (this.tip_vals[0] / 1048576).toPrecision(3);
            }
            if (this.tip_vals[2] < 1024) {
                this.text_items[5].text = Style.netunits_kbytes();
                this.menu_items[4].text = this.tip_unit_labels[2].text = _('KiB/s');
            } else if (this.tip_vals[2] < 1048576) {
                this.text_items[5].text = Style.netunits_mbytes();
                this.menu_items[4].text = this.tip_unit_labels[2].text = _('MiB/s');
                this.tip_vals[2] = (this.tip_vals[2] / 1024).toPrecision(3);
            } else {
                this.text_items[5].text = Style.netunits_gbytes();
                this.menu_items[4].text = this.tip_unit_labels[2].text = _('GiB/s');
                this.tip_vals[2] = (this.tip_vals[2] / 1048576).toPrecision(3);
            }
        }

        if (Style.get('') !== '-compact') {
            this.menu_items[0].text = this.text_items[1].text = this.tip_vals[0].toString();
            this.menu_items[3].text = this.text_items[4].text = this.tip_vals[2].toString();
        } else {
            this.menu_items[0].text = this.text_items[1].text = this._pad(this.tip_vals[0].toString(), 4);
            this.menu_items[3].text = this.text_items[4].text = this._pad(this.tip_vals[2].toString(), 4);
        }
    }
    create_text_items() {
        return [
            new St.Icon({
                icon_size: 2 * IconSize / 3 * Style.iconsize(),
                icon_name: 'go-down-symbolic'}),
            new St.Label({
                text: '',
                style_class: Style.get('sm-net-value'),
                y_align: Clutter.ActorAlign.CENTER}),
            new St.Label({
                text: _('KiB/s'),
                style_class: Style.get('sm-net-unit-label'),
                y_align: Clutter.ActorAlign.CENTER}),
            new St.Icon({
                icon_size: 2 * IconSize / 3 * Style.iconsize(),
                icon_name: 'go-up-symbolic'}),
            new St.Label({
                text: '',
                style_class: Style.get('sm-net-value'),
                y_align: Clutter.ActorAlign.CENTER}),
            new St.Label({
                text: _('KiB/s'),
                style_class: Style.get('sm-net-unit-label'),
                y_align: Clutter.ActorAlign.CENTER})
        ];
    }
    create_menu_items() {
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-value')}),
            new St.Label({
                text: _('KiB/s'),
                style_class: Style.get('sm-label')}),
            new St.Label({
                text: _(' ↓'),
                style_class: Style.get('sm-label')}),
            new St.Label({
                text: '',
                style_class: Style.get('sm-value')}),
            new St.Label({
                text: _(' KiB/s'),
                style_class: Style.get('sm-label')}),
            new St.Label({
                text: _(' ↑'),
                style_class: Style.get('sm-label')})
        ];
    }
}

const Swap = class SystemMonitor_Swap extends ElementBase {
    constructor() {
        super({
            elt: 'swap',
            item_name: _('Swap'),
            color_name: ['used']
        });
        this.max = 1;
        this.gtop = new GTop.glibtop_swap();

        GTop.glibtop_get_swap(this.gtop);
        this.total = Math.round(this.gtop.total / 1024 / 1024);
        let threshold = 4 * 1024; // In MiB
        this.useGiB = false;
        this._unitConversion = 1024 * 1024;
        this._decimals = 100;
        if (this.total > threshold) {
            this.useGiB = true;
            this._unitConversion *= 1024 / this._decimals;
        }

        this.tip_format();
        this.update();
    }
    refresh() {
        GTop.glibtop_get_swap(this.gtop);
        if (this.useGiB) {
            this.swap = Math.round(this.gtop.used / this._unitConversion);
            this.swap /= this._decimals;
            this.total = Math.round(this.gtop.total / this._unitConversion);
            this.total /= this._decimals;
        } else {
            this.swap = Math.round(this.gtop.used / this._unitConversion);
            this.total = Math.round(this.gtop.total / this._unitConversion);
        }
    }
    _pad(number) {
        if (this.useGiB) {
            if (number < 1) {
                // examples: 0.01, 0.10, 0.88
                return number.toLocaleString(Locale, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            }
            // examples: 5.85, 16.0, 128
            return number.toLocaleString(Locale, {minimumSignificantDigits: 3, maximumSignificantDigits: 3});
        }

        return number.toLocaleString(Locale);
    }
    _apply() {
        if (this.total === 0) {
            this.vals = this.tip_vals = [0];
        } else {
            this.vals[0] = this.swap / this.total;
            this.tip_vals[0] = Math.round(this.vals[0] * 100);
        }
        this.text_items[0].text = this.tip_vals[0].toString();
        this.menu_items[0].text = this.tip_vals[0].toString();
        if (Style.get('') !== '-compact') {
            this.menu_items[3].text = this._pad(this.swap) +
                ' / ' + this._pad(this.total);
        } else {
            this.menu_items[3].text = this._pad(this.swap) +
                '/' + this._pad(this.total);
        }
    }

    create_text_items() {
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-status-value'),
                y_align: Clutter.ActorAlign.CENTER}),
            new St.Label({
                text: '%',
                style_class: Style.get('sm-perc-label'),
                y_align: Clutter.ActorAlign.CENTER})
        ];
    }
    create_menu_items() {
        let unit = 'MiB';
        if (this.useGiB) {
            unit = 'GiB';
        }
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-value')}),
            new St.Label({
                text: '%',
                style_class: Style.get('sm-label')}),
            new St.Label({
                text: '',
                style_class: Style.get('sm-label')}),
            new St.Label({
                text: '',
                style_class: Style.get('sm-value')}),
            new St.Label({
                text: _(unit),
                style_class: Style.get('sm-label')})
        ];
    }
}

const Thermal = class SystemMonitor_Thermal extends ElementBase {
    constructor() {
        super({
            elt: 'thermal',
            item_name: _('Thermal'),
            color_name: ['tz0']
        });
        this.max = 100;

        this.item_name = _('Thermal');
        this.temperature = '-- ';
        this.fahrenheit_unit = Schema.get_boolean(this.elt + '-fahrenheit-unit');
        this.display_error = true;
        this.tip_format(this.temperature_symbol());
        Schema.connect('changed::' + this.elt + '-sensor-file', this.refresh.bind(this));
        this.update();
    }
    refresh() {
        let sfile = Schema.get_string(this.elt + '-sensor-file');
        if (GLib.file_test(sfile, GLib.FileTest.EXISTS)) {
            let file = Gio.file_new_for_path(sfile);
            file.load_contents_async(null, (source, result) => {
                let as_r = source.load_contents_finish(result)
                this.temperature = Math.round(parseInt(parse_bytearray(as_r[1])) / 1000);
            });
        } else if (this.display_error) {
            global.logError('error reading: ' + sfile);
            this.display_error = false;
        }

        this.fahrenheit_unit = Schema.get_boolean(this.elt + '-fahrenheit-unit');
    }
    _apply() {
        this.text_items[0].text = this.menu_items[0].text = this.temperature_text();
        this.temp_over_threshold = this.temperature > Schema.get_int('thermal-threshold');
        this.vals = [this.temperature];
        this.tip_vals[0] = this.temperature_text();
        this.text_items[1].text = this.menu_items[1].text = this.temperature_symbol();
        this.tip_unit_labels[0].text = _(this.temperature_symbol());
    }
    create_text_items() {
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-status-value'),
                y_align: Clutter.ActorAlign.CENTER}),
            new St.Label({
                text: this.temperature_symbol(),
                style_class: Style.get('sm-temp-label'),
                y_align: Clutter.ActorAlign.CENTER})
        ];
    }
    create_menu_items() {
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-value')}),
            new St.Label({
                text: this.temperature_symbol(),
                style_class: Style.get('sm-label')})
        ];
    }
    temperature_text() {
        let temperature = this.temperature;
        if (this.fahrenheit_unit) {
            temperature = Math.round(temperature * 1.8 + 32);
        }
        return temperature.toString();
    }
    temperature_symbol() {
        return this.fahrenheit_unit ? '°F' : '°C';
    }
}

const Fan = class SystemMonitor_Fan extends ElementBase {
    constructor() {
        super({
            elt: 'fan',
            item_name: _('Fan'),
            color_name: ['fan0']
        });
        this.rpm = 0;
        this.display_error = true;
        this.tip_format(_('rpm'));
        Schema.connect('changed::' + this.elt + '-sensor-file', this.refresh.bind(this));
        this.update();
    }
    refresh() {
        let sfile = Schema.get_string(this.elt + '-sensor-file');
        if (GLib.file_test(sfile, GLib.FileTest.EXISTS)) {
            let file = Gio.file_new_for_path(sfile);
            file.load_contents_async(null, (source, result) => {
                let as_r = source.load_contents_finish(result)
                this.rpm = parseInt(parse_bytearray(as_r[1]));
            });
        } else if (this.display_error) {
            global.logError('error reading: ' + sfile);
            this.display_error = false;
        }
    }
    _apply() {
        this.text_items[0].text = this.rpm.toString();
        this.menu_items[0].text = this.rpm.toString();
        this.vals = [this.rpm / 10];
        this.tip_vals[0] = this.rpm;
    }
    create_text_items() {
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-status-value'),
                y_align: Clutter.ActorAlign.CENTER}),
            new St.Label({
                text: _('rpm'), style_class: Style.get('sm-unit-label'),
                y_align: Clutter.ActorAlign.CENTER})
        ];
    }
    create_menu_items() {
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-value')}),
            new St.Label({
                text: _('rpm'),
                style_class: Style.get('sm-label')})
        ];
    }
}

const Gpu = class SystemMonitor_Gpu extends ElementBase {
    constructor() {
        super({
            elt: 'gpu',
            item_name: _('GPU'),
            color_name: ['used', 'memory']
        });
        this.max = 100;

        this.item_name = _('GPU');
        this.mem = 0;
        this.total = 0;
        this.tip_format();
        this.update();
    }
    _unit(total) {
        this.total = total;
        let threshold = 4 * 1024; // In MiB
        this.useGiB = false;
        this._unitConversion = 1;
        this._decimals = 100;
        if (this.total > threshold) {
            this.useGiB = true;
            this._unitConversion *= 1024 / this._decimals;
        }
    }
    refresh() {
        // Run asynchronously, to avoid shell freeze
        try {
            let path = Me.dir.get_path();
            let script = ['/bin/bash', path + '/gpu_usage.sh'];

            // Create subprocess and capture STDOUT
            let proc = new Gio.Subprocess({argv: script, flags: Gio.SubprocessFlags.STDOUT_PIPE});
            proc.init(null);
            // Asynchronously call the output handler when script output is ready
            proc.communicate_utf8_async(null, null, Lang.bind(this, this._handleOutput));
        } catch (err) {
            global.logError(err.message);
        }
    }
    _handleOutput(proc, result) {
        let [ok, output, ] = proc.communicate_utf8_finish(result);
        if (ok) {
            this._readTemperature(output);
        } else {
            global.logError('gpu_usage.sh invocation failed');
        }
    }
    _sanitizeUsageValue(val) {
        val = parseInt(val);
        if (isNaN(val)) {
            val = 0
        }
        return val;
    }
    _readTemperature(procOutput) {
        let usage = procOutput.split('\n');
        let memTotal = this._sanitizeUsageValue(usage[0]);
        let memUsed = this._sanitizeUsageValue(usage[1]);
        this.percentage = this._sanitizeUsageValue(usage[2]);
        if (typeof this.useGiB === 'undefined') {
            this._unit(memTotal);
            this._update_unit();
        }

        if (this.useGiB) {
            this.mem = Math.round(memUsed / this._unitConversion);
            this.mem /= this._decimals;
            this.total = Math.round(memTotal / this._unitConversion);
            this.total /= this._decimals;
        } else {
            this.mem = Math.round(memUsed / this._unitConversion);
            this.total = Math.round(memTotal / this._unitConversion);
        }
    }
    _pad(number) {
        if (this.useGiB) {
            if (number < 1) {
                // examples: 0.01, 0.10, 0.88
                return number.toFixed(2);
            }
            // examples: 5.85, 16.0, 128
            return number.toPrecision(3);
        }

        return number;
    }
    _update_unit() {
        let unit = _('MiB');
        if (this.useGiB) {
            unit = _('GiB');
        }
        this.menu_items[4].text = unit;
    }
    _apply() {
        this.tip_unit_labels[1].text = "/ " + this.total + " " + this.menu_items[4].text;
        if (this.total === 0) {
            this.vals = [0, 0];
            this.tip_vals = [0, 0];
        } else {
            // we subtract percentage from memory because we do not want memory to be 
            // "accumulated" in the chart with utilization; these two measures should be 
            // independent
            this.vals = [this.percentage, this.mem / this.total * 100 - this.percentage];
            this.tip_vals = [Math.round(this.vals[0]), this.mem];
        }
        this.text_items[0].text = this.tip_vals[0].toString();
        this.menu_items[0].text = this.tip_vals[0].toLocaleString(Locale);

        if (Style.get('') !== '-compact') {
            this.menu_items[3].text = this._pad(this.mem).toLocaleString(Locale) +
                '  /  ' + this._pad(this.total).toLocaleString(Locale);
        } else {
            this.menu_items[3].text = this._pad(this.mem).toLocaleString(Locale) +
                '/' + this._pad(this.total).toLocaleString(Locale);
        }
    }
    create_text_items() {
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-status-value'),
                y_align: Clutter.ActorAlign.CENTER}),
            new St.Label({
                text: '%',
                style_class: Style.get('sm-perc-label'),
                y_align: Clutter.ActorAlign.CENTER})
        ];
    }
    create_menu_items() {
        let unit = _('MiB');
        if (this.useGiB) {
            unit = _('GiB');
        }
        return [
            new St.Label({
                text: '',
                style_class: Style.get('sm-value')}),
            new St.Label({
                text: '%',
                style_class: Style.get('sm-label')}),
            new St.Label({
                text: '',
                style_class: Style.get('sm-label')}),
            new St.Label({
                text: '',
                style_class: Style.get('sm-value')}),
            new St.Label({
                text: unit,
                style_class: Style.get('sm-label')})
        ];
    }
}

const Icon = class SystemMonitor_Icon {
    constructor() {
        this.actor = new St.Icon({
            icon_name: 'org.gnome.SystemMonitor-symbolic',
            style_class: 'system-status-icon'
        });
        this.actor.visible = Schema.get_boolean('icon-display');
        Schema.connect(
            'changed::icon-display',
            () => {
                this.actor.visible = Schema.get_boolean('icon-display');
            }
        );
    }
}

function init() {
    log('[System monitor] applet init from ' + extension.path);

    Convenience.initTranslations();
    // Get locale, needed as an argument for toLocaleString() since GNOME Shell 3.24
    // See: mozjs library bug https://bugzilla.mozilla.org/show_bug.cgi?id=999003
    Locale = GLib.get_language_names()[0];
    if (Locale.indexOf('_') !== -1) {
        Locale = Locale.split('_')[0];
    }

    IconSize = Math.round(Panel.PANEL_ICON_SIZE * 4 / 5);
}

function enable() {
    log('[System monitor] applet enabling');
    Schema = Convenience.getSettings();

    Style = new smStyleManager();
    MountsMonitor = new smMountsMonitor();

    Background = color_from_string(Schema.get_string('background'));

    if (!(smDepsGtop && smDepsNM)) {
        Main.__sm = {
            smdialog: new smDialog()
        };

        let dialog_timeout = Mainloop.timeout_add_seconds(
            1,
            () => {
                Main.__sm.smdialog.open();
                Mainloop.source_remove(dialog_timeout);
                return true;
            });
    } else {
        let panel = Main.panel._rightBox;
        StatusArea = Main.panel._statusArea;
        if (typeof (StatusArea) === 'undefined') {
            StatusArea = Main.panel.statusArea;
        }
        if (Schema.get_boolean('center-display')) {
            panel = Main.panel._centerBox;
        }

        MountsMonitor.connect();

        // Debug
        Main.__sm = {
            tray: new PanelMenu.Button(0.5),
            icon: new Icon(),
            pie: new Pie(),
            bar: new Bar(),
            elts: [],
        };

        // Items to Monitor
        Main.__sm.elts = createCpus();
        Main.__sm.elts.push(new Freq());
        Main.__sm.elts.push(new Mem());
        Main.__sm.elts.push(new Swap());
        Main.__sm.elts.push(new Net());
        Main.__sm.elts.push(new Disk());
        Main.__sm.elts.push(new Gpu());
        Main.__sm.elts.push(new Thermal());
        Main.__sm.elts.push(new Fan());
        Main.__sm.elts.push(new Battery());

        let tray = Main.__sm.tray;
        let elts = Main.__sm.elts;

        if (Schema.get_boolean('move-clock')) {
            let dateMenu = Main.panel.statusArea.dateMenu;
            Main.panel._centerBox.remove_actor(dateMenu.container);
            Main.panel._addToPanelBox('dateMenu', dateMenu, -1, Main.panel._rightBox);
            tray.clockMoved = true;
        }

        Schema.connect('changed::background', (schema, key) => {
            Background = color_from_string(Schema.get_string(key));
        });
        Main.panel._addToPanelBox('system-monitor', tray, 1, panel);

        // The spacing adds a distance between the graphs/text on the top bar
        let spacing = Schema.get_boolean('compact-display') ? '1' : '4';
        let box = new St.BoxLayout({style: 'spacing: ' + spacing + 'px;'});
        if (shell_Version < '3.36') {
            tray.actor.add_actor(box);
        } else {
            tray.add_actor(box);
        }
        box.add_actor(Main.__sm.icon.actor);
        // Add items to panel box
        for (let elt in elts) {
            box.add_actor(elts[elt].actor);
        }

        // Build Menu Info Box Table
        let menu_info = new PopupMenu.PopupBaseMenuItem({reactive: false});
        let menu_info_box = new St.BoxLayout();
        menu_info.actor.add(menu_info_box);
        Main.__sm.tray.menu.addMenuItem(menu_info, 0);

        build_menu_info();

        tray.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let pie_item = Main.__sm.pie;
        pie_item.create_menu_item();
        tray.menu.addMenuItem(pie_item.menu_item);

        let bar_item = Main.__sm.bar;
        bar_item.create_menu_item();
        tray.menu.addMenuItem(bar_item.menu_item);

        change_usage();
        Schema.connect('changed::disk-usage-style', change_usage);

        tray.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        tray.menu.connect(
            'open-state-changed',
            function (menu, isOpen) {
                if (isOpen) {
                    Main.__sm.pie.actor.queue_repaint();

                    menu_timeout = Mainloop.timeout_add_seconds(
                        5,
                        () => {
                            Main.__sm.pie.actor.queue_repaint();
                            return true;
                        });
                } else {
                    Mainloop.source_remove(menu_timeout);
                }
            }
        );

        let _appSys = Shell.AppSystem.get_default();
        let _gsmApp = _appSys.lookup_app('gnome-system-monitor.desktop');
        let _gsmPrefs = _appSys.lookup_app('gnome-shell-extension-prefs.desktop');
        if (_gsmPrefs === null) {
            _gsmPrefs = _appSys.lookup_app('org.gnome.Extensions.desktop');
        }
        let item;
        item = new PopupMenu.PopupMenuItem(_('System Monitor...'));
        item.connect('activate', () => {
            _gsmApp.activate();
        });
        tray.menu.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_('Preferences...'));
        item.connect('activate', () => {
            if (typeof ExtensionUtils.openPrefs === 'function') {
                ExtensionUtils.openPrefs();
            } else if (_gsmPrefs.get_state() === _gsmPrefs.SHELL_APP_STATE_RUNNING) {
                _gsmPrefs.activate();
            } else {
                let info = _gsmPrefs.get_app_info();
                let timestamp = global.display.get_current_time_roundtrip();
                info.launch_uris([metadata.uuid], global.create_app_launch_context(timestamp, -1));
            }
        });
        tray.menu.addMenuItem(item);
        Main.panel.menuManager.addMenu(tray.menu);
    }
    log('[System monitor] applet enabling done');
}

function disable() {
    // restore clock
    if (Main.__sm.tray.clockMoved) {
        let dateMenu = Main.panel.statusArea.dateMenu;
        Main.panel._rightBox.remove_actor(dateMenu.container);
        Main.panel._addToPanelBox('dateMenu', dateMenu, Main.sessionMode.panel.center.indexOf('dateMenu'), Main.panel._centerBox);
    }
    // restore system power icon if necessary
    // workaround bug introduced by multiple cpus init :
    // if (Schema.get_boolean('battery-hidesystem') && Main.__sm.elts.battery.icon_hidden) {
    //    Main.__sm.elts.battery.hide_system_icon(false);
    // }
    // for (let i in Main.__sm.elts) {
    //    if (Main.__sm.elts[i].elt == 'battery')
    //        Main.__sm.elts[i].hide_system_icon(false);
    // }

    if (MountsMonitor) {
        MountsMonitor.disconnect();
        MountsMonitor = null;
    }

    if (Style) {
        Style = null;
    }

    Schema.run_dispose();
    for (let eltName in Main.__sm.elts) {
        Main.__sm.elts[eltName].destroy();
    }
    if (shell_Version < '3.36') {
        Main.__sm.tray.actor.destroy();
    } else {
        Main.__sm.tray.destroy();
    }
    Main.__sm = null;

    log('[System monitor] applet disable');
}
