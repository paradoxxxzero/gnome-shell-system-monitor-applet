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

const Config = imports.misc.config;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;

let GTop, smDepsGtop = true;
try {
    GTop = imports.gi.GTop;
} catch(e) {
    log(e);
    smDepsGtop = false;
}

let NMClient, NetworkManager, smDepsNM = true;
try {
    NMClient = imports.gi.NMClient;
    NetworkManager = imports.gi.NetworkManager;
} catch(e) {
    log(e);
    smDepsNM = false;
}

let extension = imports.misc.extensionUtils.getCurrentExtension();
let metadata = extension.metadata;

let backgroundColor, iconSize, statusArea;
let menuTimeout;
let shellVersion = Config.PACKAGE_VERSION;

extension.common = {
    get backgroundColor() { return backgroundColor; },
    get iconSize() { return iconSize; },
    get statusArea() { return statusArea; },
    get shellVersion() { return shellVersion; },
    get menuTimeout() { return menuTimeout; },
    buildMenuInfo: function() {
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
};

const _ = imports.gettext.domain('system-monitor').gettext;
const local = imports.misc.extensionUtils.getCurrentExtension().imports;
const Schema = local.convenience.getSettings();
const Convenience = local.convenience;
const Compat = local.compat;
const Style = local.model['sm-style-manager'].singleton;
const MountsMonitor = local.model['sm-mounts-monitor'].singleton;
const smDialog = local.model['sm-dialog'].constructor;
const Bar = local.model.bar.constructor;
const Pie = local.model.pie.constructor;
const Net = local.model.net.constructor;
const Battery = local.model.battery.constructor;
const createCpus = local.model.cpu.createCpus;
const Disk = local.model.disk.constructor;
const Freq = local.model.freq.constructor;
const Mem = local.model.memory.constructor;
const Swap = local.model.swap.constructor;
const Thermal = local.model.thermal.constructor;
const Fan = local.model.fan.constructor;
const Icon = local.model.icon.constructor;

function change_usage(){
    let usage = Schema.get_string('disk-usage-style');
    Main.__sm.pie.show(usage == 'pie');
    Main.__sm.bar.show(usage == 'bar');
}

this.init = function() {
    log("System monitor applet init from " + extension.path);
    Convenience.initTranslations();
    backgroundColor = Compat.color_from_string(Schema.get_string('background'));
    iconSize = Math.round(Panel.PANEL_ICON_SIZE * 4 / 5);
};

this.enable = function() {
    log("System monitor applet enabling");
    if (!(smDepsGtop && smDepsNM)) {
        Main.__sm = {
            smdialog: new smDialog()
        };

        let dialog_timeout = Mainloop.timeout_add_seconds(
            1,
            function () {
                Main.__sm.smdialog.open();
                Mainloop.source_remove(dialog_timeout);
                return true;
            });
    } else {
        let panel = Main.panel._rightBox;
        statusArea = Main.panel._statusArea || Main.panel.statusArea;

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
            elts: [],
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
            if (Compat.versionCompare(shellVersion, "3.5.90")){
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
                backgroundColor = Compat.color_from_string(Schema.get_string(key));
            }));
        if (!Compat.versionCompare(shellVersion,"3.5.5")){
            statusArea.systemMonitor = tray;
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

        extension.common.buildMenuInfo();

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

                    menuTimeout = Mainloop.timeout_add_seconds(
                        5,
                        function () {
                            Main.__sm.pie.actor.queue_repaint();
                            return true;
                        });
                } else {
                    Mainloop.source_remove(menuTimeout);
                }
            }
        );

        let _appSys = Shell.AppSystem.get_default();
        let _gsmApp = _appSys.lookup_app('gnome-system-monitor.desktop');
        let _gsmPrefs = _appSys.lookup_app('gnome-shell-extension-prefs.desktop');
        let item = new PopupMenu.PopupMenuItem(_("System Monitor..."));
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
        if (Compat.versionCompare(shellVersion, "3.5.5"))
            Main.panel.menuManager.addMenu(tray.menu);
        else
            Main.panel._menus.addMenu(tray.menu);
    }

    log("System monitor applet enabling done");
};

this.disable = function() {
    //restore clock
    if (Main.__sm.tray.clockMoved) {
        let dateMenu;
        if (Compat.versionCompare(shellVersion, "3.5.90")){
            dateMenu = Main.panel.statusArea.dateMenu;
            Main.panel._rightBox.remove_actor(dateMenu.container);
            Main.panel._addToPanelBox('dateMenu', dateMenu, Main.sessionMode.panel.center.indexOf('dateMenu'), Main.panel._centerBox);
        } else {
            dateMenu = Main.panel._dateMenu;
            Main.panel._rightBox.remove_actor(dateMenu.actor);
            Main.panel._centerBox.insert_child_at_index(dateMenu.actor, 0);
        }
    }

    MountsMonitor.disconnect();

    Schema.run_dispose();
    for (let eltName in Main.__sm.elts) {
        Main.__sm.elts[eltName].destroy();
    }

    if (!Compat.versionCompare(shellVersion,"3.5")){
        Main.__sm.tray.destroy();
        statusArea.systemMonitor = null;
    } else
        Main.__sm.tray.actor.destroy();
    Main.__sm = null;
    log("System monitor applet disable");
};
