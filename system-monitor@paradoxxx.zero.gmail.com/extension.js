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

let smDepsGtop = true;
let smDepsNM = true;

const Config = imports.misc.config;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;

const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Power = imports.ui.status.power;
//const System = imports.system;
const ModalDialog = imports.ui.modalDialog;

const ExtensionSystem = imports.ui.extensionSystem;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Compat = Me.imports.compat;

try {
    const GTop = imports.gi.GTop;
} catch(e) {
    log(e);
    smDepsGtop = false;
}

try {
    const NMClient = imports.gi.NMClient;
    const NetworkManager = imports.gi.NetworkManager;
} catch(e) {
    log(e);
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

const MESSAGE = _("Dependencies Missing\n\
Please install: \n\
libgtop, Network Manager and gir bindings \n\
\t    on Ubuntu: gir1.2-gtop-2.0, gir1.2-networkmanager-1.0 \n\
\t    on Fedora: libgtop2-devel, NetworkManager-glib-devel \n\
\t    on Arch: libgtop, networkmanager\n\
\t    on openSUSE: typelib-1_0-GTop-2_0, typelib-1_0-NetworkManager-1_0\n");

//stale network shares will cause the shell to freeze, enable this with caution
const ENABLE_NETWORK_DISK_USAGE = false;

let extension = imports.misc.extensionUtils.getCurrentExtension();
let metadata = extension.metadata;

let Schema, Background, IconSize, Style, MountsMonitor, StatusArea;
let menu_timeout, gc_timeout;
let shell_Version = Config.PACKAGE_VERSION;
function l_limit(t) {
    return (t > 0) ? t : 1000;
}
function change_text() {
    this.label.visible = Schema.get_boolean(this.elt + '-show-text');
}
function change_style() {
    let style = Schema.get_string(this.elt + '-style');
    this.text_box.visible = style == 'digit' || style == 'both';
    this.chart.actor.visible = style == 'graph' || style == 'both';
}
function change_menu() {
    this.menu_visible = Schema.get_boolean(this.elt + '-show-menu');
    build_menu_info();
}

function build_menu_info() {
    let elts = Main.__sm.elts;
    let tray_menu = Main.__sm.tray.menu;

    if (tray_menu._getMenuItems().length &&
        typeof tray_menu._getMenuItems()[0].actor.get_last_child() != 'undefined') {
        tray_menu._getMenuItems()[0].actor.get_last_child().destroy_all_children();
        for (let elt in elts) {
            elts[elt].menu_items = elts[elt].create_menu_items();
        }
    } else {
        return;
    }

    let menu_info_box_table = new St.Widget({
        style: "padding: 10px 0px 10px 0px; spacing-rows: 10px; spacing-columns: 15px;",
        layout_manager: new Clutter.TableLayout()
    });
    let menu_info_box_table_layout = menu_info_box_table.layout_manager;

    // Populate Table
    let row_index = 0;
    for (let elt in elts) {
        if (!elts[elt].menu_visible) {
            continue;
        }

        // Add item name to table
        menu_info_box_table_layout.pack(
            new St.Label({
                text: elts[elt].item_name,
                style_class: Style.get("sm-title")}), 0, row_index);

        // Add item data to table
        let col_index = 1;
        for (let item in elts[elt].menu_items) {
            menu_info_box_table_layout.pack(
                elts[elt].menu_items[item], col_index, row_index);

            col_index++;
        }

        row_index++;
    }
    tray_menu._getMenuItems()[0].actor.get_last_child().add(menu_info_box_table, {expand: true});
}

function change_usage(){
    let usage = Schema.get_string('disk-usage-style');
    Main.__sm.pie.show(usage == 'pie');
    Main.__sm.bar.show(usage == 'bar');
}
let color_from_string = Compat.color_from_string;

function interesting_mountpoint(mount){
    if (mount.length < 3)
        return false;

    return ((mount[0].indexOf("/dev/") == 0 || mount[2].toLowerCase() == "nfs") && mount[2].toLowerCase() != "udf");
}

Number.prototype.toLocaleFixed = function(dots){
    return this.toFixed(dots).toLocaleString();
}


const smStyleManager = new Lang.Class({
    Name: 'SystemMonitor.smStyleManager',
    _extension: '',
    _iconsize: 1,
    _diskunits: _('MiB/s'),
    _netunits_kbytes: _('KiB/s'),
    _netunits_mbytes: _('MiB/s'),
    _netunits_kbits : 'kbps',
    _netunits_mbits : 'Mbps',
    _pie_width : 300,
    _pie_height: 300,
    _pie_fontsize: 14,
    _bar_width : 300,
    _bar_height: 150,
    _bar_fontsize: 14,

    _init: function() {
        this._compact = Schema.get_boolean('compact-display');
        if (this._compact) {
            this._extension = '-compact';
            this._iconsize = 3/5;
            this._diskunits = _('MB');
            this._netunits_kbytes = _('kB');
            this._netunits_mbytes = _('MB');
            this._netunits_kbits = 'kb';
            this._netunits_mbits = 'Mb';
            this._pie_width  *= 4/5;
            this._pie_height *= 4/5;
            this._pie_fontsize = 12;
            this._bar_width  *= 3/5;
            this._bar_height *= 3/5;
            this._bar_fontsize = 12;
        }
    },
    get: function(style) {
        return style + this._extension;
    },
    iconsize: function() {
        return this._iconsize;
    },
    diskunits: function() {
        return this._diskunits;
    },
    netunits_kbytes: function() {
        return this._netunits_kbytes;
    },
    netunits_mbytes: function() {
        return this._netunits_mbytes;
    },
    netunits_kbits: function() {
        return this._netunits_kbits;
    },
    netunits_mbits: function() {
        return this._netunits_mbits;
    },
    pie_width: function() {
        return this._pie_width;
    },
    pie_height: function() {
        return this._pie_height;
    },
    pie_fontsize: function() {
        return this._pie_fontsize;
    },
    bar_width: function() {
        return this._bar_width;
    },
    bar_height: function() {
        return this._bar_height;
    },
    bar_fontsize: function() {
        return this._bar_fontsize;
    },
});

const smDialog = Lang.Class({
    Name: 'SystemMonitor.smDialog',
    Extends: ModalDialog.ModalDialog,

    _init : function() {
        this.parent({ styleClass: 'prompt-dialog' });
        let mainContentBox = new St.BoxLayout({ style_class: 'prompt-dialog-main-layout',
                                                vertical: false });
        this.contentLayout.add(mainContentBox,
                               { x_fill: true,
                                 y_fill: true });

        let messageBox = new St.BoxLayout({ style_class: 'prompt-dialog-message-layout',
                                            vertical: true });
        mainContentBox.add(messageBox,
                           { y_align: St.Align.START });

        this._subjectLabel = new St.Label({ style_class: 'prompt-dialog-headline',
                                            text: _("System Monitor Extension") });

        messageBox.add(this._subjectLabel,
                       { y_fill:  false,
                         y_align: St.Align.START });

        this._descriptionLabel = new St.Label({ style_class: 'prompt-dialog-description',
                                                text: MESSAGE });

        messageBox.add(this._descriptionLabel,
                       { y_fill:  true,
                         y_align: St.Align.START });


        this.setButtons([
            {
                label: _("Cancel"),
                action: Lang.bind(this, function() {
                    this.close();
                }),
                key: Clutter.Escape
            }
        ]);
    },

});

const Chart = new Lang.Class({
    Name: 'SystemMonitor.Chart',

    _init: function(width, height, parent) {
        this.actor = new St.DrawingArea({ style_class: Style.get("sm-chart"), reactive: false});
        this.parentC = parent;
        this.actor.set_width(this.width=width);
        this.actor.set_height(this.height=height);
        this.actor.connect('repaint', Lang.bind(this, this._draw));
        this.data = [];
        for (let i = 0;i < this.parentC.colors.length;i++)
            this.data[i] = [];
    },
    update: function() {
        let data_a = this.parentC.vals;
        if (data_a.length != this.parentC.colors.length) return;
        let accdata = [];
        for (let l = 0 ; l < data_a.length ; l++) {
            accdata[l] = (l == 0) ? data_a[0] : accdata[l - 1] + ((data_a[l] > 0) ? data_a[l] : 0);
            this.data[l].push(accdata[l]);
            if (this.data[l].length > this.width)
                this.data[l].shift();
        }
        if (!this.actor.visible) return;
        this.actor.queue_repaint();
    },
    _draw: function() {
        if (!this.actor.visible)
            return;
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
        for (let i = this.parentC.colors.length - 1;i >= 0;i--) {
            cr.moveTo(width, height);
            for (let j = this.data[i].length - 1;j >= 0;j--)
                cr.lineTo(width - (this.data[i].length - 1 - j), (1 - this.data[i][j] / max) * height);
            cr.lineTo(width - (this.data[i].length - 1), height);
            cr.closePath();
            Clutter.cairo_set_source_color(cr, this.parentC.colors[i]);
            cr.fill();
        }
        if (Compat.versionCompare(shell_Version, "3.7.4")) {
            cr.$dispose();
        }
    },
    resize: function(schema, key) {
        let old_width = this.width;
        this.width = Schema.get_int(key);
        if (old_width == this.width)
            return;
        this.actor.set_width(this.width);
        if (this.width < this.data[0].length)
            for (let i = 0;i < this.parentC.colors.length;i++)
                this.data[i] = this.data[i].slice(-this.width);
    }
});

// Class to deal with volumes insertion / ejection
const smMountsMonitor = new Lang.Class({
    Name: 'SystemMonitor.smMountsMonitor',
    files: new Array(),
    num_mounts: -1,
    listeners:new Array(),
    connected: false,
    _init: function() {
        this._volumeMonitor = Gio.VolumeMonitor.get();
        let sys_mounts = ['/home','/tmp','/boot','/usr','/usr/local'];
        this.base_mounts = ['/'];
        sys_mounts.forEach(Lang.bind(this,function(sMount){
            if (this.is_sys_mount(sMount+'/'))
                this.base_mounts.push(sMount);
        }));
        this.connect();

    },
    refresh: function() {
        // try check that number of volumes has changed
        /*try {
            let num_mounts = this.manager.getMounts().length;
            if (num_mounts == this.num_mounts)
                return;
            this.num_mounts = num_mounts;
        } catch (e) {};*/

        // Can't get mountlist:
        // GTop.glibtop_get_mountlist
        // Error: No symbol 'glibtop_get_mountlist' in namespace 'GTop'
        // Getting it with mtab
        /*let mount_lines = Shell.get_file_contents_utf8_sync('/etc/mtab').split("\n");
        this.mounts = [];
        for(let mount_line in mount_lines) {
            let mount = mount_lines[mount_line].split(" ");
            if(interesting_mountpoint(mount) && this.mounts.indexOf(mount[1]) < 0) {
                this.mounts.push(mount[1]);
            }
        }
        log("old mounts: " + this.mounts);*/
        this.mounts = [];
        for (let base in this.base_mounts){
            //log(this.base_mounts[base]);
            this.mounts.push(this.base_mounts[base]);
        }
        let mount_lines = this._volumeMonitor.get_mounts();
        mount_lines.forEach(Lang.bind(this, function(mount) {
            if ( !this.is_ro_mount(mount) &&
                (!this.is_net_mount(mount) || ENABLE_NETWORK_DISK_USAGE)) {

                let mpath = mount.get_root().get_path() || mount.get_default_location().get_path();
                if (mpath)
                    this.mounts.push(mpath);
            }
        }));
        //log("base: " + this.base_mounts);
        //log("mounts: " + this.mounts);
        for (let i in this.listeners){
            this.listeners[i](this.mounts);
        }
    },
    add_listener: function(cb) {
        this.listeners.push(cb);
    },
    remove_listener: function(cb) {
        this.listeners.pop(cb);
    },
    get_mounts: function() {
        return this.mounts;
    },
    is_sys_mount: function(mpath) {
        let file = Gio.file_new_for_path(mpath);
        let info = file.query_info(Gio.FILE_ATTRIBUTE_UNIX_IS_MOUNTPOINT,
                                 Gio.FileQueryInfoFlags.NONE, null);
        return info.get_attribute_boolean(Gio.FILE_ATTRIBUTE_UNIX_IS_MOUNTPOINT);
    },
    is_ro_mount: function(mount) {
        try {
            let file = mount.get_default_location();
            let info = file.query_filesystem_info(Gio.FILE_ATTRIBUTE_FILESYSTEM_READONLY, null);
            return info.get_attribute_boolean(Gio.FILE_ATTRIBUTE_FILESYSTEM_READONLY);
        } catch(e) {
            return false;
        }
    },
    is_net_mount: function(mount) {
        try {
            let file = mount.get_default_location();
            let info = file.query_filesystem_info(Gio.FILE_ATTRIBUTE_FILESYSTEM_TYPE, null);
            let result = info.get_attribute_string(Gio.FILE_ATTRIBUTE_FILESYSTEM_TYPE);
            let net_fs = ['nfs', 'smbfs', 'cifs', 'ftp', 'sshfs', 'sftp', 'mtp', 'mtpfs'];
            return !file.is_native() || net_fs.indexOf(result) > -1;
        } catch(e) {
            return false;
        }
    },
    connect: function() {
        if (this.connected)
            return;
        try {
            this.manager = this._volumeMonitor;
            this.mount_added_id = this.manager.connect('mount-added', Lang.bind(this, this.refresh));
            this.mount_removed_id = this.manager.connect('mount-removed', Lang.bind(this, this.refresh));
            //need to add the other signals here
            this.connected = true;
        }
        catch (e) {
            log('Failed to register on placesManager notifications');
            log('Got exception : ' + e);
        }
        this.refresh();
    },
    disconnect: function() {
        if (!this.connected)
            return;
        this.manager.disconnect(this.mount_added_id);
        this.manager.disconnect(this.mount_removed_id);
        this.connected = false;
    },
    destroy: function() {
        this.disconnect();
    }
});

const Graph = new Lang.Class({
    Name: 'SystemMonitor.Graph',

    menu_item: '',
    _init: function() {
        this.actor = new St.DrawingArea({ style_class: Style.get("sm-chart"), reactive: false});
        this.width = arguments[0][0];
        this.height = arguments[0][1];
        this.actor.set_width(this.width);
        this.actor.set_height(this.height);
        this.actor.connect('repaint', Lang.bind(this, this._draw));
        this.gtop = new GTop.glibtop_fsusage();
        // FIXME Handle colors correctly
        this.colors = ["#444", "#666", "#888", "#aaa", "#ccc", "#eee"];
        for(let color in this.colors) {
            this.colors[color] = color_from_string(this.colors[color]);
        }

    },
    create_menu_item: function(){
        this.menu_item = new PopupMenu.PopupBaseMenuItem({reactive: false});
        this.menu_item.actor.add(this.actor, {span: -1, expand: true});
        //tray.menu.addMenuItem(this.menu_item);
    },
    show: function(visible){
        this.menu_item.actor.visible = visible;
    }
});
const Bar = new Lang.Class({
    Name: 'SystemMonitor.Bar',
    Extends: Graph,
    _init: function() {
        this.mounts = MountsMonitor.get_mounts();
        MountsMonitor.add_listener(Lang.bind(this, this.update_mounts));
        this.thickness = 15;
        this.fontsize = Style.bar_fontsize();
        this.parent(arguments);
        this.actor.set_height(this.mounts.length * (3 * this.thickness) / 2 );
    },
    _draw: function(){
        if (!this.actor.visible) return;
        this.actor.set_height(this.mounts.length * (3 * this.thickness) / 2 );
        let [width, height] = this.actor.get_surface_size();
        let cr = this.actor.get_context();

        let x0 = width/8;
        let y0 = this.thickness/2;
        cr.setLineWidth(this.thickness);
        cr.setFontSize(this.fontsize);
        for (let mount in this.mounts) {
            GTop.glibtop_get_fsusage(this.gtop, this.mounts[mount]);
            let perc_full = (this.gtop.blocks - this.gtop.bfree)/this.gtop.blocks;
            Clutter.cairo_set_source_color(cr, this.colors[mount % this.colors.length]);
            cr.moveTo(2*x0,y0)
            cr.relLineTo(perc_full*0.6*width, 0);
            cr.moveTo(0, y0+this.thickness/3);
            cr.showText(this.mounts[mount]);
            //cr.stroke();
            cr.moveTo(width - x0, y0+this.thickness/3);
            cr.showText(Math.round(perc_full*100).toString()+'%');
            cr.stroke();
            y0 += (3 * this.thickness) / 2;
        }
        if (Compat.versionCompare(shell_Version, "3.7.4")) {
            cr.$dispose();
        }
    },
    update_mounts: function(mounts) {
        this.mounts = mounts;
        this.actor.queue_repaint();
    }
});
const Pie = new Lang.Class({
    Name: 'SystemMonitor.Pie',
    Extends: Graph,
    _init: function() {
        this.mounts = MountsMonitor.get_mounts();
        MountsMonitor.add_listener(Lang.bind(this, this.update_mounts));
        this.parent(arguments);
    },
    _draw: function() {
        if (!this.actor.visible) return;
        let [width, height] = this.actor.get_surface_size();
        let cr = this.actor.get_context();
        let xc = width / 2;
        let yc = height / 2;
        let rc = Math.min(xc, yc);
        let pi = Math.PI;
        function arc(r, value, max, angle) {
            if(max == 0) return angle;
            let new_angle = angle + (value * 2 * pi / max);
            cr.arc(xc, yc, r, angle, new_angle);
            return new_angle;
        }
        let rings = (this.mounts.length > 7?this.mounts.length:7);
        let thickness = (2 * rc) / (3 * rings);
        let fontsize = Style.pie_fontsize();
        let r = rc - (thickness / 2);
        cr.setLineWidth(thickness);
        cr.setFontSize(fontsize);
        for (let mount in this.mounts) {
            GTop.glibtop_get_fsusage(this.gtop, this.mounts[mount]);
            Clutter.cairo_set_source_color(cr, this.colors[mount % this.colors.length]);
            arc(r, this.gtop.blocks - this.gtop.bfree, this.gtop.blocks, -pi/2);
            cr.moveTo(0, yc - r + thickness / 2);
            cr.showText(this.mounts[mount]);
            cr.stroke();
            r -= (3 * thickness) / 2;
        }
        if (Compat.versionCompare(shell_Version, "3.7.4")) {
            cr.$dispose();
        }
    },
    update_mounts: function(mounts){
        this.mounts = mounts;
        this.actor.queue_repaint();
    }
});

const TipItem = new Lang.Class({
    Name: 'SystemMonitor.TipItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function() {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
        this.actor.remove_style_class_name('popup-menu-item');
        this.actor.add_style_class_name('sm-tooltip-item');
    }
});

const TipMenu = new Lang.Class({
    Name: 'SystemMonitor.TipMenu',
    Extends: PopupMenu.PopupMenuBase,

    _init: function(sourceActor){
        //PopupMenu.PopupMenuBase.prototype._init.call(this, sourceActor, 'sm-tooltip-box');
        this.parent(sourceActor, 'sm-tooltip-box');
        this.actor = new Shell.GenericContainer();
        this.actor.connect('get-preferred-width',
                           Lang.bind(this, this._boxGetPreferredWidth));
        this.actor.connect('get-preferred-height',
                           Lang.bind(this, this._boxGetPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._boxAllocate));
        this.actor.add_actor(this.box);
    },
    _boxGetPreferredWidth: function (actor, forHeight, alloc) {
        //let columnWidths = this.getColumnWidths();
        //this.setColumnWidths(columnWidths);

        [alloc.min_size, alloc.natural_size] = this.box.get_preferred_width(forHeight);
    },
    _boxGetPreferredHeight: function (actor, forWidth, alloc) {
        [alloc.min_size, alloc.natural_size] = this.box.get_preferred_height(forWidth);
    },
    _boxAllocate: function (actor, box, flags) {
        this.box.allocate(box, flags);
    },
    _shift: function() {
        //Probably old but works
        let node = this.sourceActor.get_theme_node();
        let contentbox = node.get_content_box(this.sourceActor.get_allocation_box());
        let allocation = Shell.util_get_transformed_allocation(this.sourceActor);
        let monitor = Main.layoutManager.findMonitorForActor(this.sourceActor)
        let [x, y] = [allocation.x1 + contentbox.x1,
                      allocation.y1 + contentbox.y1];
        let [cx, cy] = [allocation.x1 + (contentbox.x1 + contentbox.x2) / 2,
                        allocation.y1 + (contentbox.y1 + contentbox.y2) / 2];
        let [xm, ym] = [allocation.x1 + contentbox.x2,
                        allocation.y1 + contentbox.y2];
        let [width, height] = this.actor.get_size();
        let tipx = cx - width / 2;
        tipx = Math.max(tipx, monitor.x);
        tipx = Math.min(tipx, monitor.x + monitor.width - width);
        let tipy = Math.floor(ym);
        this.actor.set_position(tipx, tipy);
    },
    open: function(animate) {
        if (this.isOpen)
            return;

        this.isOpen = true;
        this.actor.show();
        this._shift();
        this.actor.raise_top();
        this.emit('open-state-changed', true);
    },
    close: function(animate) {
        this.isOpen = false;
        this.actor.hide();
        this.emit('open-state-changed', false);
    }
});

const TipBox = new Lang.Class({
    Name: 'SystemMonitor.TipBox',

    _init: function() {
        this.actor = new St.BoxLayout({ reactive: true});
        this.actor._delegate = this;
        this.set_tip(new TipMenu(this.actor))
        this.in_to = this.out_to = 0;
        this.actor.connect('enter-event', Lang.bind(this, this.on_enter));
        this.actor.connect('leave-event', Lang.bind(this, this.on_leave));
    },
    set_tip: function(tipmenu) {
        if (this.tipmenu)
            this.tipmenu.destroy();
        this.tipmenu = tipmenu;
        if (this.tipmenu) {
            Main.uiGroup.add_actor(this.tipmenu.actor);
            this.hide_tip();
        }
    },
    show_tip: function() {
        if (!this.tipmenu)
            return;
        this.tipmenu.open();
        if (this.in_to) {
            Mainloop.source_remove(this.in_to);
            this.in_to = 0;
        }
    },
    hide_tip: function() {
        if (!this.tipmenu)
            return;
        this.tipmenu.close();
        if (this.out_to) {
            Mainloop.source_remove(this.out_to);
            this.out_to = 0;
        }
        if (this.in_to) {
            Mainloop.source_remove(this.in_to);
            this.in_to = 0;
        }
    },
    on_enter: function() {
        let show_tooltip = Schema.get_boolean('show-tooltip');

        if (!show_tooltip)
            return;

        if (this.out_to) {
            Mainloop.source_remove(this.out_to);
            this.out_to = 0;
        }
        if (!this.in_to) {
            this.in_to = Mainloop.timeout_add(500,
                                              Lang.bind(this,
                                                        this.show_tip));
        }
    },
    on_leave: function() {
        if (this.in_to) {
            Mainloop.source_remove(this.in_to);
            this.in_to = 0;
        }
        if (!this.out_to) {
            this.out_to = Mainloop.timeout_add(500,
                                               Lang.bind(this,
                                                         this.hide_tip));
        }
    },
    destroy: function() {
        if (this.in_to) {
            Mainloop.source_remove(this.in_to);
            this.in_to = 0;
        }

        if (this.out_to) {
            Mainloop.source_remove(this.out_to);
            this.out_to = 0;
        }

        this.actor.destroy();
    },
});

const ElementBase = new Lang.Class({
    Name: 'SystemMonitor.ElementBase',
    Extends: TipBox,

    elt: '',
    item_name: _(""),
    color_name: [],
    text_items: [],
    menu_items: [],
    menu_visible: true,

    _init: function() {
        //            TipBox.prototype._init.apply(this, arguments);
        this.parent(arguments);
        this.vals = [];
        this.tip_labels = [];
        this.tip_vals = [];
        this.tip_unit_labels = [];

        this.colors = [];
        for(let color in this.color_name) {
            let name = this.elt + '-' + this.color_name[color] + '-color';
            let clutterColor = color_from_string(Schema.get_string(name));
            Schema.connect('changed::' + name, Lang.bind(
                clutterColor, function (schema, key) {
                    this.clutterColor = color_from_string(Schema.get_string(key));
                }));
            Schema.connect('changed::' + name,
                           Lang.bind(this,
                                     function() {
                                         this.chart.actor.queue_repaint();
                                     }));
            this.colors.push(clutterColor);
        }

        this.chart = new Chart(Schema.get_int(this.elt + '-graph-width'), IconSize, this);
        Schema.connect('changed::background',
                       Lang.bind(this,
                                 function() {
                                     this.chart.actor.queue_repaint();
                                 }));

        this.actor.visible = Schema.get_boolean(this.elt + "-display");
        Schema.connect(
            'changed::' + this.elt + '-display',
            Lang.bind(this,
                      function(schema, key) {
                          this.actor.visible = Schema.get_boolean(key);
                      }));

        this.interval = l_limit(Schema.get_int(this.elt + "-refresh-time"));
        this.timeout = Mainloop.timeout_add(this.interval,
                                            Lang.bind(this, this.update));
        Schema.connect(
            'changed::' + this.elt + '-refresh-time',
            Lang.bind(this,
                      function(schema, key) {
                          Mainloop.source_remove(this.timeout);
                          this.interval = l_limit(Schema.get_int(key));
                          this.timeout = Mainloop.timeout_add(
                              this.interval, Lang.bind(this, this.update));
                      }));
        Schema.connect('changed::' + this.elt + '-graph-width',
                       Lang.bind(this.chart, this.chart.resize));

        this.label = new St.Label({ text: this.elt == "memory" ? _("mem") : _(this.elt),
                                    style_class: Style.get("sm-status-label")});
        change_text.call(this);
        Schema.connect('changed::' + this.elt + '-show-text', Lang.bind(this, change_text));

        this.menu_visible = Schema.get_boolean(this.elt + '-show-menu');
        Schema.connect('changed::' + this.elt + '-show-menu', Lang.bind(this, change_menu));

        this.actor.add_actor(this.label);
        this.text_box = new St.BoxLayout();

        this.actor.add_actor(this.text_box);
        this.text_items = this.create_text_items();
        for (let item in this.text_items)
            this.text_box.add_actor(this.text_items[item]);
        this.actor.add_actor(this.chart.actor);
        change_style.call(this);
        Schema.connect('changed::' + this.elt + '-style', Lang.bind(this, change_style));
        this.menu_items = this.create_menu_items();
    },
    tip_format: function(unit) {
        typeof(unit) == 'undefined' && (unit = '%');
        if(typeof(unit) == 'string') {
            let all_unit = unit;
            unit = [];
            for (let i = 0;i < this.color_name.length;i++) {
                unit.push(all_unit);
            }
        }
        for (let i = 0;i < this.color_name.length;i++) {
            let tipline = new TipItem();
            this.tipmenu.addMenuItem(tipline);
            tipline.actor.add(new St.Label({ text: _(this.color_name[i]) }));
            this.tip_labels[i] = new St.Label();
            tipline.actor.add(this.tip_labels[i]);

            this.tip_unit_labels[i] = new St.Label({ text: unit[i] });
            tipline.actor.add(this.tip_unit_labels[i]);
            this.tip_vals[i] = 0;
        }
    },
    /*        set_tip_unit: function(unit) {
              for (let i = 0;i < this.tip_unit_labels.length;i++) {
              this.tip_unit_labels[i].text = unit[i];
              }
              },*/
    update: function() {
        if (!this.menu_visible && !this.actor.visible)
            return false;
        this.refresh();
        this._apply();
        this.chart.update();
        for (let i = 0;i < this.tip_vals.length;i++)
            this.tip_labels[i].text = this.tip_vals[i].toString();
        return true;
    },
    destroy: function() {
        TipBox.prototype.destroy.call(this);
        Mainloop.source_remove(this.timeout);
    }
});
const Battery = new Lang.Class({
    Name: 'SystemMonitor.Battery',
    Extends: ElementBase,

    elt: 'battery',
    item_name: _("Battery"),
    color_name: ['batt0'],
    max: 100,

    _init: function() {
        this.icon_hidden = false;
        this.percentage = 0;
        this.timeString = '-- ';
        this._proxy = StatusArea.aggregateMenu['_power']._proxy
        if (this._proxy == undefined)
            this._proxy = StatusArea['battery']._proxy;
        this.powerSigID = this._proxy.connect('g-properties-changed', Lang.bind(this, this.update_battery));

        //need to specify a default icon, since the contructor completes before UPower callback
        this.icon = '. GThemedIcon battery-good-symbolic battery-good';
        this.gicon = Gio.icon_new_for_string(this.icon);

        this.parent()
        this.tip_format('%');

        this.update_battery();
        this.update_tips();
        //this.hide_system_icon();
        this.update();

        //Schema.connect('changed::' + this.elt + '-hidesystem', Lang.bind(this, this.hide_system_icon));
        Schema.connect('changed::' + this.elt + '-time', Lang.bind(this, this.update_tips));
    },
    refresh: function() {
        //do nothing here?
    },
    update_battery: function(){
        // callback function for when battery stats updated.
        let battery_found = false;
        let isBattery = false;
        if (this._proxy.GetDevicesRemote == undefined) {
            let device_type = this._proxy.Type;
            isBattery = (device_type == Power.UPower.DeviceKind.BATTERY);
            if (isBattery) {
                battery_found = true;
                let icon = this._proxy.IconName;
                let percentage = this._proxy.Percentage;
                let seconds = this._proxy.TimeToEmpty;
                this.update_battery_value(seconds, percentage, icon);
            } else {
                //log("SM: No battery found");
                this.actor.hide();
                this.menu_visible = false;
                build_menu_info();
            }
        } else {
            this._proxy.GetDevicesRemote(Lang.bind(this, function(devices, error) {
                if (error) {

                    log("SM: Power proxy error: " + error)
                    this.actor.hide();
                    this.menu_visible = false;
                    build_menu_info();
                    return;
                }

                let [result] = devices;
                for (let i = 0; i < result.length; i++) {
                    let [device_id, device_type, icon, percentage, state, seconds] = result[i];

                    if (Compat.versionCompare(shell_Version, "3.9"))
                        isBattery = (device_type == Power.UPower.DeviceKind.BATTERY);
                    else
                        isBattery = (device_type == Power.UPDeviceType.BATTERY);

                    if (isBattery) {
                        battery_found = true;
                        this.update_battery_value(seconds, percentage, icon);
                        break;
                    }
                }

                if (!battery_found) {
                    //log("SM: No battery found")
                    this.actor.hide();
                    this.menu_visible = false;
                    build_menu_info();
                }
            }));
        }
    },
    update_battery_value: function(seconds, percentage, icon) {
        if (seconds > 60){
            let time = Math.round(seconds / 60);
            let minutes = time % 60;
            let hours = Math.floor(time / 60);
            this.timeString = C_("battery time remaining","%d:%02d").format(hours,minutes);
        } else {
            this.timeString = '-- ';
        }
        this.percentage = Math.ceil(percentage);
        this.gicon = Gio.icon_new_for_string(icon);

        if (Schema.get_boolean(this.elt + '-display'))
            this.actor.show()
        if (Schema.get_boolean(this.elt + '-show-menu') && this.menu_visible == false) {
            this.menu_visible = true;
            build_menu_info();
        }
    },
    hide_system_icon: function(override) {
        let value = Schema.get_boolean(this.elt + '-hidesystem');
        if (override == false ){
            value = false;
        }
        if (value && Schema.get_boolean(this.elt + '-display')){
            if (shell_Version > "3.5") {
                if (StatusArea.battery.actor.visible) {
                    StatusArea.battery.destroy();
                    this.icon_hidden = true;
                }
            }
            else {
                for (let Index = 0; Index < Main.panel._rightBox.get_children().length; Index++){
                    if(StatusArea['battery'] == Main.panel._rightBox.get_children()[Index]._delegate){
                        Main.panel._rightBox.get_children()[Index].destroy();
                        StatusArea['battery'] = null;
                        this.icon_hidden = true;
                        break;
                    }
                }
            }
        } else if(this.icon_hidden){
            if (shell_Version < "3.5") {
                let Indicator = new Panel.STANDARD_STATUS_AREA_SHELL_IMPLEMENTATION['battery'];
                Main.panel.addToStatusArea('battery', Indicator, Panel.STANDARD_STATUS_AREA_ORDER.indexOf('battery'));
            } else {
                let Indicator = new Panel.PANEL_ITEM_IMPLEMENTATIONS['battery'];
                Main.panel.addToStatusArea('battery', Indicator, Main.sessionMode.panel.right.indexOf('battery'),'right');
            }
            this.icon_hidden = false;
            //Main.panel._updatePanel('right');

        }
    },

    update_tips: function(){
        let value = Schema.get_boolean(this.elt + '-time');
        if (value) {
            this.text_items[2].text = this.menu_items[5].text = 'h';
        } else {
            this.text_items[2].text = this.menu_items[5].text = '%';
        }

        this.update();
    },
    _apply: function() {
        let displayString;
        let value = Schema.get_boolean(this.elt + '-time');
        if (value){
            displayString = this.timeString;
        } else {
            displayString = this.percentage.toString()
        }
        this.text_items[1].text = this.menu_items[3].text = displayString;
        this.text_items[0].gicon = this.gicon;
        this.vals = [this.percentage];
        this.tip_vals[0] = Math.round(this.percentage);
    },
    create_text_items: function() {
        return [new St.Icon({ gicon: Gio.icon_new_for_string(this.icon),
                              style_class: Style.get('sm-status-icon')}),
                new St.Label({ style_class: Style.get("sm-status-value")}),
                new St.Label({ text: '%', style_class: Style.get("sm-unit-label")})];
    },
    create_menu_items: function() {
        return [new St.Label(),
                new St.Label(),
                new St.Label(),
                new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label(),
                new St.Label({ text: '%', style_class: Style.get("sm-label")})];
    },
    destroy: function() {
        ElementBase.prototype.destroy.call(this);
        this._proxy.disconnect(this.powerSigID);
    }
});

/* Check if one graph per core must be displayed and create the
   appropriate number of cpu items */
function createCpus()
{
    let array = new Array();
    let numcores = 1;

    if (Schema.get_boolean("cpu-individual-cores")) {
        // get number of cores
        let gtop = new GTop.glibtop_cpu();
        try {
            numcores = GTop.glibtop_get_sysinfo().ncpu;
        } catch(e) {
            global.logError(e);
            numcores = 1;
        }
    }

    // there are several cores to display,
    // instantiate each cpu
    if (numcores > 1) {
        for (let i = 0; i < numcores; i++)
            array.push(new Cpu(i));
    }
    // individual cores option is not set or we failed to
    // get the number of cores, create a global cpu item
    else {
        array.push(new Cpu(-1));
    }

    return array;
}

const Cpu = new Lang.Class({
    Name: 'SystemMonitor.Cpu',
    Extends: ElementBase,

    elt: 'cpu',
    item_name: _("CPU"),
    color_name: ['user', 'system', 'nice', 'iowait', 'other'],
    max: 100,
    cpuid: -1, // cpuid is -1 when all cores are displayed in the same graph

    _init: function(cpuid) {
        this.cpuid = cpuid;
        this.gtop = new GTop.glibtop_cpu();
        this.last = [0,0,0,0,0];
        this.current = [0,0,0,0,0];
        try {
            this.total_cores = GTop.glibtop_get_sysinfo().ncpu;
            if (cpuid == -1)
                this.max *= this.total_cores;
        } catch(e) {
            this.total_cores = this.get_cores();
            global.logError(e)
        }
        this.last_total = 0;
        this.usage = [0,0,0,1,0];
        let item_name = _("Cpu");
        if (cpuid != -1)
            item_name += " " + (cpuid + 1); // append cpu number to cpu name in popup
        //ElementBase.prototype._init.call(this);
        this.parent()
        this.tip_format();
        this.update();
    },
    refresh: function() {
        GTop.glibtop_get_cpu(this.gtop);
        // display global cpu usage on 1 graph
        if (this.cpuid == -1) {
            this.current[0] = this.gtop.user;
            this.current[1] = this.gtop.sys;
            this.current[2] = this.gtop.nice;
            this.current[3] = this.gtop.idle;
            this.current[4] = this.gtop.iowait;
            let delta = (this.gtop.total - this.last_total)/(100*this.total_cores);

            if (delta > 0){
                for (let i = 0;i < 5;i++){
                    this.usage[i] = Math.round((this.current[i] - this.last[i])/delta);
                    this.last[i] = this.current[i];
                }
                this.last_total = this.gtop.total;
            } else if (delta < 0) {
                this.last = [0,0,0,0,0];
                this.current = [0,0,0,0,0];
                this.last_total = 0;
                this.usage = [0,0,0,1,0];
            }
        }
        // display per cpu data
        else {
            this.current[0] = this.gtop.xcpu_user[this.cpuid];
            this.current[1] = this.gtop.xcpu_sys[this.cpuid];
            this.current[2] = this.gtop.xcpu_nice[this.cpuid];
            this.current[3] = this.gtop.xcpu_idle[this.cpuid];
            this.current[4] = this.gtop.xcpu_iowait[this.cpuid];
            let delta = (this.gtop.xcpu_total[this.cpuid] - this.last_total)/100;

            if (delta > 0){
                for (let i = 0;i < 5;i++){
                    this.usage[i] = Math.round((this.current[i] - this.last[i])/delta);
                    this.last[i] = this.current[i];
                }
                this.last_total = this.gtop.xcpu_total[this.cpuid];
            } else if (delta < 0) {
                this.last = [0,0,0,0,0];
                this.current = [0,0,0,0,0];
                this.last_total = 0;
                this.usage = [0,0,0,1,0];
            }

        }

        /*
        GTop.glibtop_get_cpu(this.gtop);
        // display global cpu usage on 1 graph
        if (this.cpuid == -1)
        {
            this.current[0] = this.gtop.user;
            this.current[1] = this.gtop.sys;
            this.current[2] = this.gtop.nice;
            this.current[3] = this.gtop.idle;
            this.current[4] = this.gtop.iowait;
        }
        // display cpu usage for given core
        else
        {
            this.current[0] = this.gtop.xcpu_user[this.cpuid];
            this.current[1] = this.gtop.xcpu_sys[this.cpuid];
            this.current[2] = this.gtop.xcpu_nice[this.cpuid];
            this.current[3] = this.gtop.xcpu_idle[this.cpuid];
            this.current[4] = this.gtop.xcpu_iowait[this.cpuid];
        }

        let delta = 0;
        if (this.cpuid == -1)
            delta = (this.gtop.total - this.last_total)/(100*this.total_cores);
        else
            delta = (this.gtop.xcpu_total[this.cpuid] - this.last_total)/100;

        if (delta > 0){
            for (let i = 0;i < 5;i++){
                this.usage[i] = Math.round((this.current[i] - this.last[i])/delta);
                this.last[i] = this.current[i];
            }
            if (this.cpuid == -1)
                this.last_total = this.gtop.total;
            else
                this.last_total = this.gtop.xcpu_total[this.cpuid];
        }
        */
    },
    _apply: function() {
        let percent = 0;
        if (this.cpuid == -1)
            percent = Math.round(((100 * this.total_cores) - this.usage[3])
                                 / this.total_cores);
        else
            percent = Math.round((100 - this.usage[3]));

        this.text_items[0].text = this.menu_items[3].text = percent.toString();
        let other = 100;
        for (let i = 0;i < this.usage.length;i++)
            other -= this.usage[i];
        //Not to be confusing
        other = Math.max(0, other);
        this.vals = [this.usage[0], this.usage[1],
                     this.usage[2], this.usage[4], other];
        for (let i = 0;i < 5;i++)
            this.tip_vals[i] = Math.round(this.vals[i]);
    },

    get_cores: function(){
        // Getting xcpu_total makes gjs 1.29.18 segfault
        // let cores = 0;
        // GTop.glibtop_get_cpu(this.gtop);
        // let gtop_total = this.gtop.xcpu_total
        // for (let i = 0; i < gtop_total.length;i++){
        //     if (gtop_total[i] > 0)
        //         cores++;
        // }
        // return cores;
        return 1;
    },
    create_text_items: function() {
        return [new St.Label({ style_class: Style.get("sm-status-value")}),
                new St.Label({ text: '%', style_class: Style.get("sm-perc-label")})];

    },
    create_menu_items: function() {
        return [new St.Label(),
                new St.Label(),
                new St.Label(),
                new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label(),
                new St.Label({ text: '%', style_class: Style.get("sm-label")})];
    }
});

const Disk = new Lang.Class({
    Name: 'SystemMonitor.Disk',
    Extends: ElementBase,

    elt: 'disk',
    item_name: _("Disk"),
    color_name: ['read', 'write'],

    _init: function() {
        this.mounts = MountsMonitor.get_mounts();
        MountsMonitor.add_listener(Lang.bind(this, this.update_mounts));
        this.last = [0,0];
        this.usage = [0,0];
        this.last_time = 0;
        this.parent()
        this.tip_format(_('MiB/s'));
        this.update();
    },
    update_mounts : function(mounts){
        this.mounts = mounts;
    },
    refresh: function() {
        let accum = [0, 0];
        let lines = Shell.get_file_contents_utf8_sync('/proc/diskstats').split("\n");

        for(let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let entry = line.trim().split(/[\s]+/);
            if(entry[1] == undefined)
                break;
            accum[0] += parseInt(entry[5]);
            accum[1] += parseInt(entry[9]);
        }

        let time = GLib.get_monotonic_time() / 1000;
        let delta = (time - this.last_time) / 1000;
        if (delta > 0)
            for (let i = 0;i < 2;i++) {
                this.usage[i] =((accum[i] - this.last[i]) / delta / 1024 / 8);
                this.last[i] = accum[i];
            }
        this.last_time = time;
    },
    _apply: function() {
        this.vals = this.usage.slice();
        for (let i = 0;i < 2;i++) {
            if (this.usage[i] < 10)
                this.usage[i] = this.usage[i].toLocaleFixed(1);
            else
                this.usage[i] = Math.round(this.usage[i]);
        }
        this.tip_vals = [this.usage[0] , this.usage[1]];
        this.menu_items[0].text = this.text_items[1].text = this.tip_vals[0].toString();
        this.menu_items[3].text = this.text_items[4].text = this.tip_vals[1].toString();
    },
    create_text_items: function() {
        return [new St.Label({ text: _('R'), style_class: Style.get("sm-status-label")}),
                new St.Label({ style_class: Style.get("sm-disk-value")}),
                new St.Label({ text: Style.diskunits(), style_class: Style.get("sm-disk-unit-label")}),
                new St.Label({ text: _('W'), style_class: Style.get("sm-status-label")}),
                new St.Label({ style_class: Style.get("sm-disk-value")}),
                new St.Label({ text: Style.diskunits(), style_class: Style.get("sm-disk-unit-label")})];
    },
    create_menu_items: function() {
        return [new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label({ text:_('MiB/s'), style_class: Style.get("sm-label-left")}),
                new St.Label({ text:_('R'), style_class: Style.get("sm-label")}),
                new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label({ text:_('MiB/s'), style_class: Style.get("sm-label-left")}),
                new St.Label({ text:_('W'), style_class: Style.get("sm-label")})];
    },
});

const Freq = new Lang.Class({
    Name: 'SystemMonitor.Freq',
    Extends: ElementBase,

    elt: 'freq',
    item_name: _("Freq"),
    color_name: ['freqmin', 'freqavg', 'freqmax'],

    _init: function() {
        this.freq = [0, 0, 0];
        this.parent()
        this.tip_format('MHz');
        this.update();
    },
    refresh: function() {
        let lines = Shell.get_file_contents_utf8_sync('/proc/cpuinfo').split("\n");
        let freq_max = 0;
        let freq_min = 100000;
        let freq_avg = 0;
        let cpu_count = 0;
        for(let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if(line.search(/^cpu MHz/) < 0)
                continue;
            let this_freq = parseInt(line.substring(line.indexOf(':') + 2));
            freq_avg += this_freq;
            if(this_freq < freq_min)
                freq_min = this_freq;
            if(this_freq > freq_max)
                freq_max = this_freq;
            cpu_count++;
        }
        this.freq[0] = freq_min;
        this.freq[1] = Math.round(freq_avg / cpu_count);
        this.freq[2] = freq_max;
    },
    _apply: function() {
        let value_min = this.freq[0].toString();
        let value_avg = this.freq[1].toString();
        let value_max = this.freq[2].toString();
        this.vals[0] = this.freq[0];
        this.vals[1] = this.freq[1] - this.freq[0];
        this.vals[2] = this.freq[2] - this.freq[1];
        this.text_items[0].text = value_avg + ' ';
        this.tip_vals[0] = value_min;
        this.tip_vals[1] = value_avg;
        this.tip_vals[2] = value_max;
        this.menu_items[3].text = value_avg;
    },
    create_text_items: function() {
        return [new St.Label({ style_class: Style.get("sm-big-status-value")}),
                new St.Label({ text: 'MHz', style_class: Style.get("sm-perc-label")})];

    },
    create_menu_items: function() {
        return [new St.Label(),
                new St.Label(),
                new St.Label(),
                new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label(),
                new St.Label({ text: 'MHz', style_class: Style.get("sm-label")})];
    }
});

const Mem = new Lang.Class({
    Name: 'SystemMonitor.Mem',
    Extends: ElementBase,

    elt: 'memory',
    item_name: _("Memory"),
    color_name: ['program', 'buffer', 'cache'],
    max: 1,

    _init: function() {
        this.gtop = new GTop.glibtop_mem();
        this.mem = [0, 0, 0];
        this.parent()
        this.tip_format();
        this.update();

        GTop.glibtop_get_mem(this.gtop);
        this.total = Math.round(this.gtop.total / 1024 / 1024);
        let threshold = 4*1024; // In MiB
        this.useGiB = false;
        if (this.total > threshold)
            this.useGiB = true;
    },
    refresh: function() {
        GTop.glibtop_get_mem(this.gtop);
        let decimals = 100;
        if (this.useGiB) {
            this.mem[0] = Math.round(this.gtop.user / 1024 / 1024 /1024 * decimals);
            this.mem[0] /= decimals;
            this.mem[1] = Math.round(this.gtop.buffer / 1024 / 1024 /1024 * decimals);
            this.mem[1] /= decimals;
            this.mem[2] = Math.round(this.gtop.cached / 1024 / 1024 / 1024 * decimals);
            this.mem[2] /= decimals;
            this.total = Math.round(this.gtop.total / 1024 / 1024 / 1024 * decimals);
            this.total /= decimals;
        } else {
            this.mem[0] = Math.round(this.gtop.user / 1024 / 1024);
            this.mem[1] = Math.round(this.gtop.buffer / 1024 / 1024);
            this.mem[2] = Math.round(this.gtop.cached / 1024 / 1024);
            this.total = Math.round(this.gtop.total / 1024 / 1024);
        }
    },
    _apply: function() {
        if (this.total == 0) {
            this.vals = this.tip_vals = [0,0,0];
        } else {
            for (let i = 0;i < 3;i++) {
                this.vals[i] = this.mem[i] / this.total;
                this.tip_vals[i] = Math.round(this.vals[i] * 100);
            }
        }
        this.text_items[0].text = this.tip_vals[0].toString();
        this.menu_items[0].text = this.mem[0].toString();
        this.menu_items[3].text = this.total.toString();
    },
    create_text_items: function() {
        return [new St.Label({ style_class: Style.get("sm-status-value")}),
                new St.Label({ text: '%', style_class: Style.get("sm-perc-label")})];
    },
    create_menu_items: function() {
        let unit = 'MiB';
        if (this.useGiB)
            unit = 'GiB';
        return [new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label(),
                new St.Label({ text: "/", style_class: Style.get("sm-label")}),
                new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label(),
                new St.Label({ text: _(unit), style_class: Style.get("sm-label")})];
    }
});

const Net = new Lang.Class({
    Name: 'SystemMonitor.Net',
    Extends: ElementBase,

    elt: 'net',
    item_name: _("Net"),
    color_name: ['down', 'downerrors', 'up', 'uperrors', 'collisions'],
    speed_in_bits: false,

    _init: function() {
        this.ifs = [];
        this.client = NMClient.Client.new();
        this.update_iface_list();

        if(!this.ifs.length){
            let net_lines = Shell.get_file_contents_utf8_sync('/proc/net/dev').split("\n");
            for(let i = 2; i < net_lines.length - 1 ; i++) {
                let ifc = net_lines[i].replace(/^\s+/g, '').split(":")[0];
                if(Shell.get_file_contents_utf8_sync('/sys/class/net/' + ifc + '/operstate')
                   .replace(/\s/g, "") == "up" &&
                   ifc.indexOf("br") < 0 &&
                   ifc.indexOf("lo") < 0) {
                    this.ifs.push(ifc);
                }
            }
        }
        this.gtop = new GTop.glibtop_netload();
        this.last = [0, 0, 0, 0, 0];
        this.usage = [0, 0, 0, 0, 0];
        this.last_time = 0;
        this.parent()
        this.tip_format([_('KiB/s'), '/s', _('KiB/s'), '/s', '/s']);
        this.update_units();
        Schema.connect('changed::' + this.elt + '-speed-in-bits', Lang.bind(this, this.update_units));
        try {
            let iface_list = this.client.get_devices();
            this.NMsigID = []
            for(let j = 0; j < iface_list.length; j++) {
                this.NMsigID[j] = iface_list[j].connect('state-changed' , Lang.bind(this, this.update_iface_list));
            }
        }
        catch(e) {
            global.logError("Please install Network Manager Gobject Introspection Bindings: " + e);
        }
        this.update();
    },
    update_units: function() {
        this.speed_in_bits = Schema.get_boolean(this.elt + '-speed-in-bits');
    },
    update_iface_list: function() {
        try {
            this.ifs = []
            let iface_list = this.client.get_devices();
            for(let j = 0; j < iface_list.length; j++){
                if (iface_list[j].state == NetworkManager.DeviceState.ACTIVATED){
                    this.ifs.push(iface_list[j].get_ip_iface() || iface_list[j].get_iface());
                }
            }
        }
        catch(e) {
            global.logError("Please install Network Manager Gobject Introspection Bindings");
        }
    },
    refresh: function() {
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
        if (delta > 0)
            for (let i = 0;i < 5;i++) {
                this.usage[i] = Math.round((accum[i] - this.last[i]) / delta);
                this.last[i] = accum[i];
                this.vals[i] = this.usage[i];
            }
        this.last_time = time;
    },

    // pad a string with leading 0s
    _pad:function(number, length) {
        var str = '' + number;
        while (str.length < length) {
            str = '0' + str;
        }
        return str;
    },

    _apply: function() {
        this.tip_vals = this.usage;
        if (this.speed_in_bits) {
            this.tip_vals[0] = Math.round(this.tip_vals[0] * 8.192);
            this.tip_vals[2] = Math.round(this.tip_vals[2] * 8.192);
            if (this.tip_vals[0] < 1000) {
                this.text_items[2].text = Style.netunits_kbits();
                this.menu_items[1].text = this.tip_unit_labels[0].text = 'kbps';
            }
            else {
                this.text_items[2].text = Style.netunits_mbits();
                this.menu_items[1].text = this.tip_unit_labels[0].text = 'Mbps';
                this.tip_vals[0] = (this.tip_vals[0] / 1000).toPrecision(3);
            }
            if (this.tip_vals[2] < 1000) {
                this.text_items[5].text = Style.netunits_kbits();
                this.menu_items[4].text = this.tip_unit_labels[2].text = 'kbps';
            }
            else {
                this.text_items[5].text = Style.netunits_mbits();
                this.menu_items[4].text = this.tip_unit_labels[2].text = 'Mbps';
                this.tip_vals[2] = (this.tip_vals[2] / 1000).toPrecision(3);
            }
        }
        else {
            if (this.tip_vals[0] < 1024) {
                this.text_items[2].text = Style.netunits_kbytes();
                this.menu_items[1].text = this.tip_unit_labels[0].text = _('KiB/s');
            }
            else {
                this.text_items[2].text = Style.netunits_mbytes();
                this.menu_items[1].text = this.tip_unit_labels[0].text = _('MiB/s');
                this.tip_vals[0] = (this.tip_vals[0] / 1024).toPrecision(3);
            }
            if (this.tip_vals[2] < 1024) {
                this.text_items[5].text = Style.netunits_kbytes();
                this.menu_items[4].text = this.tip_unit_labels[2].text = _('KiB/s');
            }
            else {
                this.text_items[5].text = Style.netunits_mbytes();
                this.menu_items[4].text = this.tip_unit_labels[2].text = _('MiB/s');
                this.tip_vals[2] = (this.tip_vals[2] / 1024).toPrecision(3);
            }
        }

        if (Style.get('') != '-compact') {
            this.menu_items[0].text = this.text_items[1].text = this.tip_vals[0].toString();
            this.menu_items[3].text = this.text_items[4].text = this.tip_vals[2].toString();
        }
        else {
            this.menu_items[0].text = this.text_items[1].text = this._pad(this.tip_vals[0].toString(), 3);
            this.menu_items[3].text = this.text_items[4].text = this._pad(this.tip_vals[2].toString(), 3);
        }

    },
    create_text_items: function() {
        return [new St.Icon({icon_size: 2 * IconSize / 3 * Style.iconsize(),
                              icon_name:'go-down-symbolic'}),
                new St.Label({ style_class: Style.get("sm-net-value")}),
                new St.Label({ text: _('KiB/s'), style_class: Style.get("sm-net-unit-label")}),
                new St.Icon({ icon_size: 2 * IconSize / 3 * Style.iconsize(),
                              icon_name:'go-up-symbolic'}),
                new St.Label({ style_class: Style.get("sm-net-value")}),
                new St.Label({ text: _('KiB/s'), style_class: Style.get("sm-net-unit-label")})];
    },
    create_menu_items: function() {
        return [new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label({ text:_('KiB/s'), style_class: Style.get("sm-label")}),
                new St.Label({ text:_('Down'), style_class: Style.get("sm-label")}),
                new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label({ text:_('KiB/s'), style_class: Style.get("sm-label")}),
                new St.Label({ text:_('Up'), style_class: Style.get("sm-label")})];
    }
});

const Swap = new Lang.Class({
    Name: 'SystemMonitor.Swap',
    Extends: ElementBase,

    elt: 'swap',
    item_name: _("Swap"),
    color_name: ['used'],
    max: 1,

    _init: function() {
        this.gtop = new GTop.glibtop_swap();
        this.parent()
        this.tip_format();
        this.update();

        GTop.glibtop_get_swap(this.gtop);
        this.total = Math.round(this.gtop.total / 1024 / 1024);
        let threshold = 4*1024; // In MiB
        this.useGiB = false;
        if (this.total > threshold)
            this.useGiB = true;
    },
    refresh: function() {
        GTop.glibtop_get_swap(this.gtop);
        let decimals = 100;
        if (this.useGiB) {
            this.swap = Math.round(this.gtop.used / 1024 / 1024 / 1024 * decimals);
            this.swap /= decimals;
            this.total = Math.round(this.gtop.total / 1024 / 1024 /1024 * decimals);
            this.total /= decimals;
        } else {
            this.swap = Math.round(this.gtop.used / 1024 / 1024);
            this.total = Math.round(this.gtop.total / 1024 / 1024);
        }
    },
    _apply: function() {
        if (this.total == 0) {
            this.vals = this.tip_vals = [0];
        } else {
            this.vals[0] = this.swap / this.total;
            this.tip_vals[0] = Math.round(this.vals[0] * 100);
        }
        this.text_items[0].text = this.tip_vals[0].toString();
        this.menu_items[0].text = this.swap.toString();
        this.menu_items[3].text = this.total.toString();
    },

    create_text_items: function() {
        return [new St.Label({ style_class: Style.get("sm-status-value")}),
                new St.Label({ text: '%', style_class: Style.get("sm-perc-label")})];
    },
    create_menu_items: function() {
        let unit = 'MiB';
        if (this.useGiB)
            unit = 'GiB';
        return [new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label(),
                new St.Label({ text: "/", style_class: Style.get("sm-label")}),
                new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label(),
                new St.Label({ text: _(unit), style_class: Style.get("sm-label")})];
    }
});

const Thermal = new Lang.Class({
    Name: 'SystemMonitor.Thermal',
    Extends: ElementBase,

    elt: 'thermal',
    item_name: _("Thermal"),
    color_name: ['tz0'],
    max: 100,
    _init: function() {
        this.temperature = '-- ';
        this.display_error = true;
        this.parent()
        this.tip_format('\u2103');
        Schema.connect('changed::' + this.elt + '-sensor-file', Lang.bind(this, this.refresh));
        this.update();
    },
    refresh: function() {
        let sfile = Schema.get_string(this.elt + '-sensor-file');
        if(GLib.file_test(sfile, 1 << 4)) {
            let file = Gio.file_new_for_path(sfile);
            file.load_contents_async(null, Lang.bind(this, function (source, result) {
                let as_r = source.load_contents_finish(result)
                this.temperature = Math.round(parseInt(as_r[1]) / 1000);
            }));
        } else {
            if (this.display_error) {
                global.logError("error reading: " + sfile);
                this.display_error = false;
            }
        }
    },
    _apply: function() {
        this.text_items[0].text = this.menu_items[3].text = this.temperature.toString();
        //Making it looks better in chart.
        //this.vals = [this.temperature / 100];
        this.vals = [this.temperature];
        this.tip_vals[0] = this.temperature;
    },
    create_text_items: function() {
        return [new St.Label({ style_class: Style.get("sm-status-value")}),
                new St.Label({ text: '\u2103', style_class: Style.get("sm-temp-label")})];
    },
    create_menu_items: function() {
        return [new St.Label(),
                new St.Label(),
                new St.Label(),
                new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label(),
                new St.Label({ text: '\u2103', style_class: Style.get("sm-label")})];
    }
});

const Fan = new Lang.Class({
    Name: 'SystemMonitor.Fan',
    Extends: ElementBase,

    elt: 'fan',
    item_name: _("Fan"),
    color_name: ['fan0'],

    _init: function() {
        this.rpm = 0;
        this.display_error = true;
        this.parent()
        this.tip_format(_("rpm"));
        Schema.connect('changed::' + this.elt + '-sensor-file', Lang.bind(this, this.refresh));
        this.update();
    },
    refresh: function() {
        let sfile = Schema.get_string(this.elt + '-sensor-file');
        if(GLib.file_test(sfile, 1 << 4)) {
            let file = Gio.file_new_for_path(sfile);
            file.load_contents_async(null, Lang.bind(this, function (source, result) {
                let as_r = source.load_contents_finish(result)
                this.rpm = parseInt(as_r[1]);
            }));
        } else {
            if (this.display_error) {
                global.logError("error reading: " + sfile);
                this.display_error = false;
            }
        }
    },
    _apply: function() {
        this.text_items[0].text = this.rpm.toString();
        this.menu_items[3].text = this.rpm.toString();
        this.vals = [this.rpm / 10];
        this.tip_vals[0] = this.rpm;
    },
    create_text_items: function() {
        return [new St.Label({ style_class: Style.get("sm-status-value")}),
                new St.Label({ text: _("rpm"), style_class: Style.get("sm-unit-label")})];
    },
    create_menu_items: function() {
        return [new St.Label(),
                new St.Label(),
                new St.Label(),
                new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label(),
                new St.Label({ text: _("rpm"), style_class: Style.get("sm-label")})];
    }
});

const Icon = new Lang.Class({
    Name: 'SystemMonitor.Icon',

    _init: function() {
        this.actor = new St.Icon({ icon_name: 'utilities-system-monitor-symbolic',
                                   style_class: 'system-status-icon'});
        this.actor.visible = Schema.get_boolean("icon-display");
        Schema.connect(
            'changed::icon-display',
            Lang.bind(this,
                      function () {
                          this.actor.visible = Schema.get_boolean("icon-display");
                      }));
    }
});


var init = function () {
    log("System monitor applet init from " + extension.path);

    Convenience.initTranslations();
    Schema = Convenience.getSettings();

    Style = new smStyleManager();
    MountsMonitor = new smMountsMonitor();

    Background = color_from_string(Schema.get_string('background'));

    IconSize = Math.round(Panel.PANEL_ICON_SIZE * 4 / 5);
};

var enable = function () {
    log("System monitor applet enabling");
    if (!(smDepsGtop && smDepsNM)) {
        Main.__sm = {
            smdialog: new smDialog()
        }

        let dialog_timeout = Mainloop.timeout_add_seconds(
            1,
            function () {
                Main.__sm.smdialog.open()
                Mainloop.source_remove(dialog_timeout);
                return true;
            });
    } else {
        let panel = Main.panel._rightBox;
        StatusArea = Main.panel._statusArea;
        if (StatusArea == undefined){
            StatusArea = Main.panel.statusArea;
        }
        if (Schema.get_boolean("center-display")) {
            panel = Main.panel._centerBox;
        }

        MountsMonitor.connect();

        //Debug
        Main.__sm = {
            tray: new PanelMenu.Button(0.5),
            icon: new Icon(),
            pie: new Pie(Style.pie_width(), Style.pie_height()), // 300, 300
            bar: new Bar(Style.bar_width(), Style.bar_height()),  // 300, 150
            elts: new Array(),
        };

        // Items to Monitor
        Main.__sm.elts = createCpus();
        Main.__sm.elts.push(new Freq());
        Main.__sm.elts.push(new Mem());
        Main.__sm.elts.push(new Swap());
        Main.__sm.elts.push(new Net());
        Main.__sm.elts.push(new Disk());
        Main.__sm.elts.push(new Thermal());
        Main.__sm.elts.push(new Fan());
        Main.__sm.elts.push(new Battery());

        let tray = Main.__sm.tray;
        let elts = Main.__sm.elts;


        if (Schema.get_boolean("move-clock")) {
            let dateMenu;
            if (Compat.versionCompare(shell_Version, "3.5.90")){
                dateMenu = Main.panel.statusArea.dateMenu;
                Main.panel._centerBox.remove_actor(dateMenu.container);
                Main.panel._addToPanelBox('dateMenu', dateMenu, -1, Main.panel._rightBox);
            } else {
                dateMenu = Main.panel._dateMenu;
                Main.panel._centerBox.remove_actor(dateMenu.actor);
                Main.panel._rightBox.insert_child_at_index(dateMenu.actor, -1);
            }
            tray.clockMoved = true;
        }

        Schema.connect('changed::background', Lang.bind(
            this, function (schema, key) {
                Background = color_from_string(Schema.get_string(key));
            }));
        if (!Compat.versionCompare(shell_Version,"3.5.5")){
            StatusArea.systemMonitor = tray;
            panel.insert_child_at_index(tray.actor, 1);
            panel.child_set(tray.actor, { y_fill: true } );
        } else {
            Main.panel._addToPanelBox('system-monitor', tray, 1, panel);
        }

        let box = new St.BoxLayout();
        tray.actor.add_actor(box);
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
        Schema.connect('changed::' + 'disk-usage-style', change_usage);

        tray.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        tray.menu.connect(
            'open-state-changed',
            function (menu, isOpen) {
                if(isOpen) {
                    Main.__sm.pie.actor.queue_repaint();

                    menu_timeout = Mainloop.timeout_add_seconds(
                        5,
                        function () {
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
        let item;
        item = new PopupMenu.PopupMenuItem(_("System Monitor..."));
        item.connect('activate', function () {
            _gsmApp.activate();
        });
        tray.menu.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_("Preferences..."));
        item.connect('activate', function () {
            if (_gsmPrefs.get_state() == _gsmPrefs.SHELL_APP_STATE_RUNNING){
                _gsmPrefs.activate();
            } else {
                let info = _gsmPrefs.get_app_info();
                let timestamp = global.display.get_current_time_roundtrip();
                info.launch_uris([metadata.uuid], global.create_app_launch_context(timestamp, -1));
            }
        });
        tray.menu.addMenuItem(item);
        if (Compat.versionCompare(shell_Version, "3.5.5"))
            Main.panel.menuManager.addMenu(tray.menu);
        else
            Main.panel._menus.addMenu(tray.menu);
    }

    log("System monitor applet enabling done");
};

var disable = function () {
    //restore clock
    if (Main.__sm.tray.clockMoved) {
        let dateMenu;
        if (Compat.versionCompare(shell_Version, "3.5.90")){
            dateMenu = Main.panel.statusArea.dateMenu;
            Main.panel._rightBox.remove_actor(dateMenu.container);
            Main.panel._addToPanelBox('dateMenu', dateMenu, Main.sessionMode.panel.center.indexOf('dateMenu'), Main.panel._centerBox);
        } else {
            dateMenu = Main.panel._dateMenu;
            Main.panel._rightBox.remove_actor(dateMenu.actor);
            Main.panel._centerBox.insert_child_at_index(dateMenu.actor, 0);
        }
    }
    //restore system power icon if necessary
    // workaround bug introduced by multiple cpus init :
    //if (Schema.get_boolean('battery-hidesystem') && Main.__sm.elts.battery.icon_hidden){
    //    Main.__sm.elts.battery.hide_system_icon(false);
    //}
    //for (let i in Main.__sm.elts) {
    //    if (Main.__sm.elts[i].elt == 'battery')
    //        Main.__sm.elts[i].hide_system_icon(false);
    //}

    MountsMonitor.disconnect();

    Schema.run_dispose();
    for (let eltName in Main.__sm.elts) {
        Main.__sm.elts[eltName].destroy();
    }

    if (!Compat.versionCompare(shell_Version,"3.5")){
        Main.__sm.tray.destroy();
        StatusArea.systemMonitor = null;
    } else
        Main.__sm.tray.actor.destroy();
    Main.__sm = null;
    log("System monitor applet disable");

};
