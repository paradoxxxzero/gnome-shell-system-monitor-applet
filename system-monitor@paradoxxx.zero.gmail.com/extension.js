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

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;

const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Power = imports.ui.status.power;
const System = imports.system;
const ModalDialog = imports.ui.modalDialog;

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

const Gettext = imports.gettext.domain('system-monitor-applet');
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const _ = Gettext.gettext;

const MESSAGE = _("Dependencies Missing\n\
Please install: \n\
libgtop, Network Manager and gir bindings \n\
\t    on Ubuntu: gir1.2-gtop-2.0, gir1.2-networkmanager-1.0 \n\
\t    on Fedora: libgtop2-devel, NetworkManager-glib-devel \n\
\t    on Arch: libgtop, networkmanager\n");

let extension = imports.misc.extensionUtils.getCurrentExtension();
let metadata = extension.metadata;

let Schema, Background, IconSize;
let menu_timeout, gc_timeout;

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
    this.menu_item.actor.visible = Schema.get_boolean(this.elt + '-show-menu');
}
function change_usage(){
    let usage = Schema.get_string('disk-usage-style');
    Main.__sm.pie.show(usage == 'pie');
    Main.__sm.bar.show(usage == 'bar');
}

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
        //            this.parent()
        this.actor = new St.DrawingArea({ style_class: "sm-chart", reactive: false});
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
const Graph = new Lang.Class({
    Name: 'SystemMonitor.Graph',

    menu_item: '',
    _init: function() {
        // Can't get mountlist:
        // GTop.glibtop_get_mountlist
        // Error: No symbol 'glibtop_get_mountlist' in namespace 'GTop'
        // Getting it with mtab
        let mount_lines = Shell.get_file_contents_utf8_sync('/etc/mtab').split("\n");
        this.mounts = [];
        for(let mount_line in mount_lines) {
            let mount = mount_lines[mount_line].split(" ");
            if(mount[0].indexOf("/dev/") == 0 && this.mounts.indexOf(mount[1]) < 0) {
                this.mounts.push(mount[1]);
            }
        }

        this.actor = new St.DrawingArea({ style_class: "sm-chart", reactive: false});
        this.width = arguments[0][0];
        this.height = arguments[0][1];
        this.actor.set_width(this.width);
        this.actor.set_height(this.height);
        this.actor.connect('repaint', Lang.bind(this, this._draw));
        this.gtop = new GTop.glibtop_fsusage();
        // FIXME Handle colors correctly
        this.colors = ["#444", "#666", "#888", "#aaa", "#ccc", "#eee"];
        for(let color in this.colors) {
            let clutterColor = new Clutter.Color();
            clutterColor.from_string(this.colors[color]);
            this.colors[color] = clutterColor;
        }

    },
    create_menu_item: function(){
        this.menu_item = new PopupMenu.PopupBaseMenuItem({reactive: false});
        this.menu_item.addActor(this.actor, {span: -1, expand: true});
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
        this.thickness = 15;
        this.fontsize = 14;
        this.parent(arguments);
        this.actor.set_height(this.mounts.length * (3 * this.thickness) / 2 );
    },
    _draw: function(){
        if (!this.actor.visible) return;
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
    }
});
const Pie = new Lang.Class({
    Name: 'SystemMonitor.Pie',
    Extends: Graph,
    _init: function() {
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
        let fontsize = 14;
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
        let columnWidths = this.getColumnWidths();
        this.setColumnWidths(columnWidths);

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
    color_name: [],
    text_items: [],
    menu_items: [],
    _init: function() {
        //            TipBox.prototype._init.apply(this, arguments);
        this.parent(arguments);
        this.vals = [];
        this.tip_labels = [];
        this.tip_vals = [];
        this.tip_unit_labels = [];

        this.colors = [];
        for(let color in this.color_name) {
            let clutterColor = new Clutter.Color();
            let name = this.elt + '-' + this.color_name[color] + '-color';
            clutterColor.from_string(Schema.get_string(name));
            Schema.connect('changed::' + name, Lang.bind(
                clutterColor, function (schema, key) {
                    this.from_string(Schema.get_string(key));
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
                                    style_class: "sm-status-label"});
        change_text.call(this);
        Schema.connect('changed::' + this.elt + '-show-text', Lang.bind(this, change_text));

        change_menu.call(this);
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
        for (let item in this.menu_items)
            this.menu_item.addActor(this.menu_items[item]);
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
            tipline.addActor(new St.Label({ text: _(this.color_name[i]) }));
            this.tip_labels[i] = new St.Label();
            tipline.addActor(this.tip_labels[i]);

            this.tip_unit_labels[i] = new St.Label({ text: unit[i] });
            tipline.addActor(this.tip_unit_labels[i]);
            this.tip_vals[i] = 0;
        }
    },
    /*        set_tip_unit: function(unit) {
              for (let i = 0;i < this.tip_unit_labels.length;i++) {
              this.tip_unit_labels[i].text = unit[i];
              }
              },*/
    update: function() {
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
    color_name: ['batt0'],
    max: 100,

    _init: function() {
        this.icon_hidden = false;
        this.percentage = 0;
        this.timeString = '-- ';
        this._proxy = Main.panel._statusArea['battery']._proxy;
        this.powerSigID = this._proxy.connect('g-properties-changed', Lang.bind(this, this.update_battery));

        //need to specify a default icon, since the contructor completes before UPower callback
        this.icon = '. GThemedIcon battery-good-symbolic battery-good';
        this.gicon = Gio.icon_new_for_string(this.icon);

        this.menu_item = new PopupMenu.PopupMenuItem(_("Battery"), {reactive: false});

        this.parent()
        this.tip_format('%');

        this.update_battery();
        this.update_tips();
        this.hide_system_icon();
        this.update();

        Schema.connect('changed::' + this.elt + '-hidesystem', Lang.bind(this, this.hide_system_icon));
        Schema.connect('changed::' + this.elt + '-time', Lang.bind(this, this.update_tips));
    },
    refresh: function() {
        //do nothing here?
    },
    update_battery: function(){
        // callback function for when battery stats updated.
        let battery_found = false;
        this._proxy.GetDevicesRemote(Lang.bind(this, function(devices, error) {
            if (error) {

                log("SM: Power proxy error: " + error)
                this.actor.hide();
                this.menu_item.actor.hide();
                return;
            }

            let [result] = devices;
            for (let i = 0; i < result.length; i++) {
                let [device_id, device_type, icon, percentage, state, seconds] = result[i];
                if (device_type == Power.UPDeviceType.BATTERY && !battery_found) {
                    battery_found = true;
                    //grab data
                    if (seconds > 60){
                        let time = Math.round(seconds / 60);
                        let minutes = time % 60;
                        let hours = Math.floor(time / 60);
                        this.percentage = Math.floor(percentage);
                        this.timeString = C_("battery time remaining","%d:%02d").format(hours,minutes);
                    } else {
                        this.timeString = '-- ';
                    }
                    this.gicon = Gio.icon_new_for_string(icon);

                    if (Schema.get_boolean(this.elt + '-display'))
                        this.actor.show()
                    if (Schema.get_boolean(this.elt + '-show-menu'))
                        this.menu_item.actor.show();
                }
            }
            if (!battery_found) {
                log("SM: No battery found")
                this.actor.hide();

                this.menu_item.actor.hide();
            }
        }));
    },
    hide_system_icon: function(override) {
        let value = Schema.get_boolean(this.elt + '-hidesystem');
        if (override == false ){
            value = false;
        }
        if (value && Schema.get_boolean(this.elt + '-display')){
            for (let Index = 0; Index < Main.panel._rightBox.get_children().length; Index++){
                if(Main.panel._statusArea['battery'] == Main.panel._rightBox.get_children()[Index]._delegate){
                    Main.panel._rightBox.get_children()[Index].destroy();
                    Main.panel._statusArea['battery'] = null;
                    this.icon_hidden = true;
                    break;
                }
            }
        } else if(this.icon_hidden){
            let Indicator = new Panel.STANDARD_STATUS_AREA_SHELL_IMPLEMENTATION['battery'];
            Main.panel.addToStatusArea('battery', Indicator, Panel.STANDARD_STATUS_AREA_ORDER.indexOf('battery'));
            this.icon_hidden = false;
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
                              icon_type: St.IconType.FULLCOLOR,
                              style_class: 'sm-status-icon' }),
                new St.Label({ style_class: "sm-status-value"}),
                new St.Label({ text: '%', style_class: "sm-unit-label"})];
    },
    create_menu_items: function() {
        return [new St.Label({ style_class: "sm-void"}),
                new St.Label({ style_class: "sm-void"}),
                new St.Label({ style_class: "sm-void"}),
                new St.Label({ style_class: "sm-value"}),
                new St.Label({ style_class: "sm-void"}),
                new St.Label({ text: '%', style_class: "sm-label"})];
    },
    destroy: function() {
        ElementBase.prototype.destroy.call(this);
        this._proxy.disconnect(this.powerSigID);
    }
});


const Cpu = new Lang.Class({
    Name: 'SystemMonitor.Cpu',
    Extends: ElementBase,

    elt: 'cpu',
    color_name: ['user', 'system', 'nice', 'iowait', 'other'],
    max: 100,

    _init: function() {
        this.gtop = new GTop.glibtop_cpu();
        this.last = [0,0,0,0,0];
        this.current = [0,0,0,0,0];
        try {
            this.total_cores = GTop.glibtop_get_sysinfo().ncpu;
            this.max *= this.total_cores;
        } catch(e) {
            this.total_cores = this.get_cores();
            global.logError(e)
        }
        this.last_total = 0;
        this.usage = [0,0,0,1,0];
        this.menu_item = new PopupMenu.PopupMenuItem(_("Cpu"), {reactive: false});
        //ElementBase.prototype._init.call(this);
        this.parent()
        this.tip_format();
        this.update();
    },
    refresh: function() {
        GTop.glibtop_get_cpu(this.gtop);
        this.current[0] = this.gtop.user;
        this.current[1] = this.gtop.sys;
        this.current[2] = this.gtop.nice;
        this.current[3] = this.gtop.idle;
        this.current[4] = this.gtop.iowait;

        let delta = (this.gtop.total - this.last_total)/(100*this.total_cores) ;
        if (delta > 0){
            for (let i = 0;i < 5;i++){
                this.usage[i] = Math.round((this.current[i] - this.last[i])/delta);
                this.last[i] = this.current[i];
            }
            this.last_total = this.gtop.total;
        }
    },
    _apply: function() {
        let percent = Math.round(((100 * this.total_cores) - this.usage[3])
                                 / this.total_cores);
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
        return [new St.Label({ style_class: "sm-status-value"}),
                new St.Label({ text: '%', style_class: "sm-perc-label"})];

    },
    create_menu_items: function() {
        return [new St.Label({ style_class: "sm-void"}),
                new St.Label({ style_class: "sm-void"}),
                new St.Label({ style_class: "sm-void"}),
                new St.Label({ style_class: "sm-value"}),
                new St.Label({ style_class: "sm-void"}),
                new St.Label({ text: '%', style_class: "sm-label"})];
    }
});

const Disk = new Lang.Class({
    Name: 'SystemMonitor.Disk',
    Extends: ElementBase,

    elt: 'disk',
    color_name: ['read', 'write'],
    _init: function() {
        // Can't get mountlist:
        // GTop.glibtop_get_mountlist
        // Error: No symbol 'glibtop_get_mountlist' in namespace 'GTop'
        // Getting it with mtab
        let mount_lines = Shell.get_file_contents_utf8_sync('/etc/mtab').split("\n");
        this.mounts = [];
        for(let mount_line in mount_lines) {
            let mount = mount_lines[mount_line].split(" ");
            if(mount[0].indexOf("/dev/") == 0 && this.mounts.indexOf(mount[1]) < 0) {
                this.mounts.push(mount[1]);
            }
        }
        this.gtop = new GTop.glibtop_fsusage();
        this.last = [0,0];
        this.usage = [0,0];
        this.last_time = 0;
        GTop.glibtop_get_fsusage(this.gtop, this.mounts[0]);
        this.block_size = this.gtop.block_size/1024/1024/8;
        this.menu_item = new PopupMenu.PopupMenuItem(_("Disk"), {reactive: false});
        this.parent()
        this.tip_format('KiB/s');
        this.update();
    },
    refresh: function() {
        let accum = [0, 0];

        for(let mount in this.mounts) {
            GTop.glibtop_get_fsusage(this.gtop, this.mounts[mount]);
            accum[0] += this.gtop.read;
            accum[1] += this.gtop.write;
        }
        let time = GLib.get_monotonic_time() / 1000;
        let delta = (time - this.last_time) / 1000;
        if (delta > 0)
            for (let i = 0;i < 2;i++) {
                this.usage[i] =(this.block_size* (accum[i] - this.last[i]) / delta) ;
                this.last[i] = accum[i];
            }
        this.last_time = time;
    },
    _apply: function() {
        this.vals = this.usage.slice();
        for (let i = 0;i < 2;i++) {
            if (this.usage[i] < 10)
                this.usage[i] = this.usage[i].toFixed(1);
            else
                this.usage[i] = Math.round(this.usage[i]);
        }
        this.tip_vals = [this.usage[0] , this.usage[1]];
        this.menu_items[0].text = this.text_items[1].text = this.tip_vals[0].toString();
        this.menu_items[3].text = this.text_items[4].text = this.tip_vals[1].toString();
    },
    create_text_items: function() {
        return [new St.Label({ text: 'R', style_class: "sm-status-label"}),
                new St.Label({ style_class: "sm-status-value"}),
                new St.Label({ text: 'MiB/s', style_class: "sm-perc-label"}),
                new St.Label({ text: 'W', style_class: "sm-status-label"}),
                new St.Label({ style_class: "sm-status-value"}),
                new St.Label({ text: 'MiB/s', style_class: "sm-perc-label"})];
    },
    create_menu_items: function() {
        return [new St.Label({ style_class: "sm-value"}),
                new St.Label({ text:'MiB/s', style_class: "sm-label"}),
                new St.Label({ text:'R', style_class: "sm-label"}),
                new St.Label({ style_class: "sm-value"}),
                new St.Label({ text:'MiB/s', style_class: "sm-label"}),
                new St.Label({ text:'W', style_class: "sm-label"})];
    }
});

const Freq = new Lang.Class({
    Name: 'SystemMonitor.Freq',
    Extends: ElementBase,

    elt: 'freq',
    color_name: ['freq'],
    _init: function() {
        this.freq = 0;
        this.menu_item = new PopupMenu.PopupMenuItem(_("Freq"), {reactive: false});
        this.parent()
        this.tip_format('MHz');
        this.update();
    },
    refresh: function() {
        let lines = Shell.get_file_contents_utf8_sync('/proc/cpuinfo').split("\n");
        for(let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if(line.search(/cpu mhz/i) < 0)
                continue;
            this.freq = parseInt(line.substring(line.indexOf(':') + 2));
            break;
        }
    },
    _apply: function() {
        let value = this.freq.toString();
        this.text_items[0].text = value + ' ';
        this.tip_vals[0] = value;
        this.menu_items[3].text = value;
    },
    create_text_items: function() {
        return [new St.Label({ style_class: "sm-big-status-value"}),
                new St.Label({ text: 'MHz', style_class: "sm-perc-label"})];

    },
    create_menu_items: function() {
        return [new St.Label({ style_class: "sm-void"}),
                new St.Label({ style_class: "sm-void"}),
                new St.Label({ style_class: "sm-void"}),
                new St.Label({ style_class: "sm-value"}),
                new St.Label({ style_class: "sm-void"}),
                new St.Label({ text: 'MHz', style_class: "sm-label"})];
    }
});

const Mem = new Lang.Class({
    Name: 'SystemMonitor.Mem',
    Extends: ElementBase,

    elt: 'memory',
    color_name: ['program', 'buffer', 'cache'],
    max: 1,

    _init: function() {
        this.menu_item = new PopupMenu.PopupMenuItem(_("Memory"), {reactive: false});
        this.gtop = new GTop.glibtop_mem();
        this.mem = [0, 0, 0];
        this.parent()
        this.tip_format();
        this.update();
    },
    refresh: function() {
        GTop.glibtop_get_mem(this.gtop);
        this.mem[0] = Math.round(this.gtop.user / 1024 / 1024);
        this.mem[1] = Math.round(this.gtop.buffer / 1024 / 1024);
        this.mem[2] = Math.round(this.gtop.cached / 1024 / 1024);
        this.total = Math.round(this.gtop.total / 1024 / 1024);
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
        return [new St.Label({ style_class: "sm-status-value"}),
                new St.Label({ text: '%', style_class: "sm-perc-label"})];
    },
    create_menu_items: function() {
        return [new St.Label({ style_class: "sm-value"}),
                new St.Label({ style_class: "sm-void"}),
                new St.Label({ text: "/", style_class: "sm-label"}),
                new St.Label({ style_class: "sm-value"}),
                new St.Label({ style_class: "sm-void"}),
                new St.Label({ text: 'MiB', style_class: "sm-label"})];
    }
});

const Net = new Lang.Class({
    Name: 'SystemMonitor.Net',
    Extends: ElementBase,

    elt: 'net',
    color_name: ['down', 'downerrors', 'up', 'uperrors', 'collisions'],
    speed_in_bits: false,
    _init: function() {
        this.ifs = [];
        this.client = NMClient.Client.new();
        this.update_iface_list();

        if(!this.ifs.length){
            let net_lines = Shell.get_file_contents_utf8_sync('/proc/net/dev').split("\n");
            for(let i = 3; i < net_lines.length - 1 ; i++) {
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
        this.menu_item = new PopupMenu.PopupMenuItem(_("Net"), {reactive: false});
        this.parent()
        this.tip_format(['KiB/s', '/s', 'KiB/s', '/s', '/s']);
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
    _apply: function() {
        this.tip_vals = this.usage;
        if (this.speed_in_bits) {
            this.tip_vals[0] = Math.round(this.tip_vals[0] * 8.192);
            this.tip_vals[2] = Math.round(this.tip_vals[2] * 8.192);
            if (this.tip_vals[0] < 1000)
                this.text_items[2].text = this.menu_items[1].text = this.tip_unit_labels[0].text = 'kbps';
            else {
                this.text_items[2].text = this.menu_items[1].text = this.tip_unit_labels[0].text = 'Mbps';
                this.tip_vals[0] = (this.tip_vals[0] / 1000).toPrecision(3);
            }
            if (this.tip_vals[2] < 1000)
                this.text_items[5].text = this.menu_items[4].text = this.tip_unit_labels[2].text = 'kbps';
            else {
                this.text_items[5].text = this.menu_items[4].text = this.tip_unit_labels[2].text = 'Mbps';
                this.tip_vals[2] = (this.tip_vals[2] / 1000).toPrecision(3);
            }
        }
        else {
            if (this.tip_vals[0] < 1024)
                this.text_items[2].text = this.menu_items[1].text = this.tip_unit_labels[0].text = 'KiB/s';
            else {
                this.text_items[2].text = this.menu_items[1].text = this.tip_unit_labels[0].text = 'MiB/s';
                this.tip_vals[0] = (this.tip_vals[0] / 1024).toPrecision(3);
            }
            if (this.tip_vals[2] < 1024)
                this.text_items[5].text = this.menu_items[4].text = this.tip_unit_labels[2].text = 'KiB/s';
            else {
                this.text_items[5].text = this.menu_items[4].text = this.tip_unit_labels[2].text = 'MiB/s';
                this.tip_vals[2] = (this.tip_vals[2] / 1024).toPrecision(3);
            }
        }
        this.menu_items[0].text = this.text_items[1].text = this.tip_vals[0].toString();
        this.menu_items[3].text = this.text_items[4].text = this.tip_vals[2].toString();
    },
    create_text_items: function() {
        return [new St.Icon({ icon_type: St.IconType.SYMBOLIC,
                              icon_size: 2 * IconSize / 3,
                              icon_name:'go-down'}),
                new St.Label({ style_class: "sm-status-value"}),
                new St.Label({ text: 'KiB/s', style_class: "sm-unit-label"}),
                new St.Icon({ icon_type: St.IconType.SYMBOLIC,
                              icon_size: 2 * IconSize / 3,
                              icon_name:'go-up'}),
                new St.Label({ style_class: "sm-status-value"}),
                new St.Label({ text: 'KiB/s', style_class: "sm-unit-label"})];
    },
    create_menu_items: function() {
        return [new St.Label({ style_class: "sm-value"}),
                new St.Label({ text:'KiB/s', style_class: "sm-label"}),
                new St.Icon({ icon_type: St.IconType.SYMBOLIC,
                              icon_size: 16, icon_name:'go-down'}),
                new St.Label({ style_class: "sm-value"}),
                new St.Label({ text:'KiB/s', style_class: "sm-label"}),
                new St.Icon({ icon_type: St.IconType.SYMBOLIC,
                              icon_size: 16, icon_name:'go-up'})];
    }
});

const Swap = new Lang.Class({
    Name: 'SystemMonitor.Swap',
    Extends: ElementBase,

    elt: 'swap',
    color_name: ['used'],
    max: 1,

    _init: function() {
        this.menu_item = new PopupMenu.PopupMenuItem(_("Swap"), {reactive: false});
        this.gtop = new GTop.glibtop_swap();
        this.parent()
        this.tip_format();
        this.update();
    },
    refresh: function() {
        GTop.glibtop_get_swap(this.gtop);
        this.swap = Math.round(this.gtop.used / 1024 / 1024);
        this.total = Math.round(this.gtop.total / 1024 / 1024);
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
        return [new St.Label({ style_class: "sm-status-value"}),
                new St.Label({ text: '%', style_class: "sm-perc-label"})];
    },
    create_menu_items: function() {
        return [new St.Label({ style_class: "sm-value"}),
                new St.Label({ style_class: "sm-void"}),
                new St.Label({ text: "/", style_class: "sm-label"}),
                new St.Label({ style_class: "sm-value"}),
                new St.Label({ style_class: "sm-void"}),
                new St.Label({ text: 'MiB', style_class: "sm-label"})];
    }
});

const Thermal = new Lang.Class({
    Name: 'SystemMonitor.Thermal',
    Extends: ElementBase,

    elt: 'thermal',
    color_name: ['tz0'],
    _init: function() {
        this.temperature = -273.15;
        this.menu_item = new PopupMenu.PopupMenuItem(_("Thermal"), {reactive: false});
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
                this.temperature = parseInt(as_r[1]) / 1000;
            }));
        } else {
            global.logError("error reading: " + sfile);
        }
    },
    _apply: function() {
        this.text_items[0].text = this.menu_items[3].text = this.temperature.toString();
        //Making it looks better in chart.
        this.vals = [this.temperature / 100];
        this.tip_vals[0] = Math.round(this.temperature);
    },
    create_text_items: function() {
        return [new St.Label({ style_class: "sm-status-value"}),
                new St.Label({ text: '\u2103', style_class: "sm-temp-label"})];
    },
    create_menu_items: function() {
        return [new St.Label({ style_class: "sm-void"}),
                new St.Label({ style_class: "sm-void"}),
                new St.Label({ style_class: "sm-void"}),
                new St.Label({ style_class: "sm-value"}),
                new St.Label({ style_class: "sm-void"}),
                new St.Label({ text: '\u2103', style_class: "sm-label"})];
    }
});

const Icon = new Lang.Class({
    Name: 'SystemMonitor.Icon',

    _init: function() {
        this.actor = new St.Icon({ icon_name: 'utilities-system-monitor',
                                   icon_type: St.IconType.SYMBOLIC,
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

    let me = extension.imports.convenience;
    me.initTranslations(extension);
    Schema = me.getSettings(extension, 'system-monitor');

    Background = new Clutter.Color();
    Background.from_string(Schema.get_string('background'));
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
        if (Schema.get_boolean("center-display")) {
            if (Schema.get_boolean("move-clock")) {
                let dateMenu = Main.panel._dateMenu;
                Main.panel._centerBox.remove_actor(dateMenu.actor);
                Main.panel._rightBox.insert_child_at_index(dateMenu.actor, -1);
            }
            panel = Main.panel._centerBox;
        }
        Schema.connect('changed::background', Lang.bind(
            Background, function (schema, key) {
                this.from_string(Schema.get_string(key));
            }));

        //Debug
        Main.__sm = {
            tray: new PanelMenu.Button(0.5),
            icon: new Icon(),
            pie: new Pie(300, 300),
            bar: new Bar(300, 150),
            elts: {
                cpu: new Cpu(),
                freq: new Freq(),
                memory: new Mem(),
                swap: new Swap(),
                net: new Net(),
                disk: new Disk(),
                thermal: new Thermal(),
                battery: new Battery(),
            }
        };
        let tray = Main.__sm.tray;
        Main.panel._statusArea.systemMonitor = tray;
        panel.insert_child_at_index(tray.actor, 1);
        panel.child_set(tray.actor, { y_fill: true } );
        let box = new St.BoxLayout();
        tray.actor.add_actor(box);
        box.add_actor(Main.__sm.icon.actor);
        for (let elt in Main.__sm.elts) {
            box.add_actor(Main.__sm.elts[elt].actor);
            tray.menu.addMenuItem(Main.__sm.elts[elt].menu_item);
        }

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
                _gsmPrefs.launch(global.display.get_current_time_roundtrip(),
                                 [metadata.uuid],-1,null);
            }
        });
        tray.menu.addMenuItem(item);
        Main.panel._menus.addMenu(tray.menu);

    }
    log("System monitor applet enabling done");
};

var disable = function () {
    //restore system power icon if necessary
    if (Schema.get_boolean('battery-hidesystem') && Main.__sm.elts.battery.icon_hidden){
        Main.__sm.elts.battery.hide_system_icon(false);
    }
    Schema.run_dispose();
    for (let eltName in Main.__sm.elts) {
        Main.__sm.elts[eltName].destroy();
    }
    Main.__sm.tray.destroy();
    Main.panel._statusArea.systemMonitor = null;
    Main.__sm = null;
    log("System monitor applet disable");
};
