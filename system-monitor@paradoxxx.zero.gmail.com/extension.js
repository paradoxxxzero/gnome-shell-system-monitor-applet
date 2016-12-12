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
