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

const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

function SystemMonitor() {
    this._init.apply(this, arguments);
}

SystemMonitor.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init_menu: function() {
        let section = new PopupMenu.PopupMenuSection("Memory");
        let item = new PopupMenu.PopupMenuItem("Memory");
        this._mem = new St.Label();
        this._mem_total = new St.Label();
        item.addActor(new St.Label({ text:':'}));
        item.addActor(this._mem);
        item.addActor(new St.Label({ text: "/"}));
        item.addActor(this._mem_total);
        item.addActor(new St.Label({ text: "M"}));
        section.addMenuItem(item);
        this.menu.addMenuItem(section);

        section = new PopupMenu.PopupMenuSection("Swap");
        item = new PopupMenu.PopupMenuItem("Swap");
        this._swap = new St.Label();
        this._swap_total = new St.Label();
        item.addActor(new St.Label({ text:':'}));
        item.addActor(this._swap);
        item.addActor(new St.Label({ text: "/"}));
        item.addActor(this._swap_total);
        item.addActor(new St.Label({ text: "M"}));
        section.addMenuItem(item);
        this.menu.addMenuItem(section);

        section = new PopupMenu.PopupMenuSection("Cpu");
        item = new PopupMenu.PopupMenuItem("Cpu");
        item.addActor(new St.Label({ text:':'}));
        this._cpu = new St.Label();
        item.addActor(new St.Label());
        item.addActor(new St.Label());
        item.addActor(this._cpu);
        item.addActor(new St.Label({ text:'%'}));
        section.addMenuItem(item);
        this.menu.addMenuItem(section);
    },
    _init_status: function() {
        let box = new St.BoxLayout();
        let icon = new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: Main.panel.button.height - 4, icon_name:'utilities-system-monitor'});
        this._mem_ = new St.Label();
        this._swap_ = new St.Label();
        this._cpu_ = new St.Label();

        box.add_actor(icon);
        box.add_actor(new St.Label({ text: ' mem: '}));
        box.add_actor(this._mem_);
        box.add_actor(new St.Label({ text: ' ~ swap: '}));
        box.add_actor(this._swap_);
        box.add_actor(new St.Label({ text: ' ~ cpu: '}));
        box.add_actor(this._cpu_);

        this.actor.set_child(box);
    },
    _init: function() {
	Panel.__system_monitor = this;
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'utilities-system-monitor', 'System monitor');
	this.__last_cpu_time = 0
	this.__last_cpu_idle = 0
	this.__last_cpu_total = 0

        this._init_menu();
        this._init_status();

	this._update_mem_swap();
	this._update_cpu();

        GLib.timeout_add(0, 10000, function () {
            Panel.__system_monitor._update_mem_swap();
            return true;
        });
        GLib.timeout_add(0, 1500, function () {
            Panel.__system_monitor._update_cpu();
            return true;
        });
    },

    _update_mem_swap: function() {
        let this_ = Panel.__system_monitor;

        let free = GLib.spawn_command_line_sync('free -m');
        if(free[0]) {
            let free_lines = free[1].split("\n");

            let mem_params = free_lines[1].replace(/ +/g, " ").split(" ");
            let percentage = Math.round(mem_params[2]/mem_params[1]*100);
            this_._mem_.set_text(" " + percentage + "%");
            this_._mem.set_text(mem_params[2]);
            this_._mem_total.set_text(mem_params[1]);

            let swap_params = free_lines[3].replace(/ +/g, " ").split(" ");
            percentage = Math.round(swap_params[2]/swap_params[1]*100);
            this_._swap_.set_text(" " + percentage + "%");
            this_._swap.set_text(swap_params[2]);
            this_._swap_total.set_text(swap_params[1]);
        } else {
	    global.log("system-monitor: free -m returned an error");
	}
    },

    _update_cpu: function() {
        let this_ = Panel.__system_monitor;
        let stat = GLib.spawn_command_line_sync('cat /proc/stat');
        if(stat[0]) {
            let stat_lines = stat[1].split("\n");
	    let cpu_params = stat_lines[1].replace(/ +/g, " ").split(" ");
	    let idle = parseInt(cpu_params[4]);
	    let total = parseInt(cpu_params[1]) + parseInt(cpu_params[2]) + parseInt(cpu_params[3]) + parseInt(cpu_params[4]);
	    let time = GLib.get_monotonic_time() / 1000;
	    if(this_.__last_cpu_time != 0) {
		let delta = time - this_.__last_cpu_time;
		let cpu_usage = (100 - Math.round(100 * (idle - this_.__last_cpu_idle) / (total - this_.__last_cpu_total)));
		this_._cpu_.set_text(' ' + cpu_usage + '%');
		this_._cpu.set_text(cpu_usage.toString());
	    }
	    this_.__last_cpu_idle = idle;
	    this_.__last_cpu_total = total;
	    this_.__last_cpu_time = time;
        } else {
	    global.log("system-monitor: cat /proc/stat returned an error");
	}
    },

    _onDestroy: function() {}
};


function main() {
	Panel.STANDARD_TRAY_ICON_ORDER.unshift('system-monitor');
	Panel.STANDARD_TRAY_ICON_SHELL_IMPLEMENTATION['system-monitor'] = SystemMonitor;
}
