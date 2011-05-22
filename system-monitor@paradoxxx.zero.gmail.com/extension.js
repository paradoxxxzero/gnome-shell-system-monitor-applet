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

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St = imports.gi.St;

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
        let section = new PopupMenu.PopupMenuSection("Usages");
        this.menu.addMenuItem(section);

        let item = new PopupMenu.PopupMenuItem("Memory");
        this._mem = new St.Label({ style_class: "sm-value"});
        this._mem_total = new St.Label({ style_class: "sm-value"});
        item.addActor(new St.Label({ text:':', style_class: "sm-label"}));
        item.addActor(this._mem);
        item.addActor(new St.Label({ text: "/", style_class: "sm-label"}));
        item.addActor(this._mem_total);
        item.addActor(new St.Label({ text: "M", style_class: "sm-label"}));
        section.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem("Swap");
        this._swap = new St.Label({ style_class: "sm-value"});
        this._swap_total = new St.Label({ style_class: "sm-value"});
        item.addActor(new St.Label({ text:':', style_class: "sm-label"}));
        item.addActor(this._swap);
        item.addActor(new St.Label({ text: "/", style_class: "sm-label"}));
        item.addActor(this._swap_total);
        item.addActor(new St.Label({ text: "M", style_class: "sm-label"}));
        section.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem("Cpu");
        item.addActor(new St.Label({ text:':', style_class: "sm-label"}));
        this._cpu = new St.Label({ style_class: "sm-value"});
        item.addActor(new St.Label({ style_class: "sm-void"}));
        item.addActor(new St.Label({ style_class: "sm-void"}));
        item.addActor(this._cpu);
        item.addActor(new St.Label({ text:'%', style_class: "sm-label"}));
        section.addMenuItem(item);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        section = new PopupMenu.PopupMenuSection("Toggling");
        this.menu.addMenuItem(section);
	this._mem_widget = new PopupMenu.PopupSwitchMenuItem("Display memory", true);
	this._mem_widget.connect('toggled', Lang.bind(this, function(item) {
	                                                  this._mem_box.visible = item.state;
	                                                  if(this._schema) {
		                                              this._schema.set_boolean("memory-display", item.state);
	                                                  }
                                                      }));
        section.addMenuItem(this._mem_widget);
	this._swap_widget = new PopupMenu.PopupSwitchMenuItem("Display swap", true);
	this._swap_widget.connect('toggled', Lang.bind(this, function(item) {
	                                                   this._swap_box.visible = item.state;
	                                                   if(this._schema) {
		                                               this._schema.set_boolean("swap-display", item.state);
	                                                   }
                                                       }));
        section.addMenuItem(this._swap_widget);
	this._cpu_widget = new PopupMenu.PopupSwitchMenuItem("Display cpu", true);
	this._cpu_widget.connect('toggled', Lang.bind(this, function(item) {
	                                                  this._cpu_box.visible = item.state;
	                                                  if(this._schema) {
		                                              this._schema.set_boolean("cpu-display", item.state);
	                                                  }
                                                      }));
        section.addMenuItem(this._cpu_widget);
    },
    _init_status: function() {
        let box = new St.BoxLayout();
        let icon = new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: Main.panel.button.height - 4, icon_name:'utilities-system-monitor'});
        this._mem_ = new St.Label({ style_class: "sm-status-value"});
        this._swap_ = new St.Label({ style_class: "sm-status-value"});
        this._cpu_ = new St.Label({ style_class: "sm-status-value"});

        box.add_actor(icon);

	this._mem_box = new St.BoxLayout();
        this._mem_box.add_actor(new St.Label({ text: 'mem', style_class: "sm-status-label"}));
        this._mem_box.add_actor(this._mem_);
	box.add_actor(this._mem_box);

	this._swap_box = new St.BoxLayout();
        this._swap_box.add_actor(new St.Label({ text: 'swap', style_class: "sm-status-label"}));
        this._swap_box.add_actor(this._swap_);
	box.add_actor(this._swap_box);

	this._cpu_box = new St.BoxLayout();
        this._cpu_box.add_actor(new St.Label({ text: 'cpu', style_class: "sm-status-label"}));
        this._cpu_box.add_actor(this._cpu_);
	box.add_actor(this._cpu_box);

        this.actor.set_child(box);
    },
    _init: function() {
	Panel.__system_monitor = this;
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'utilities-system-monitor', 'System monitor');
	this.__last_cpu_time = 0;
	this.__last_cpu_idle = 0;
	this.__last_cpu_total = 0;

        this._init_status();
	this._schema = false;
        this._init_menu();

	this._schema = new Gio.Settings({ schema: 'org.gnome.shell.extensions.system-monitor' });
	this._mem_box.visible = this._schema.get_boolean("memory-display");
	this._mem_widget.setToggleState(this._mem_box.visible);
	this._swap_box.visible = this._schema.get_boolean("swap-display");
	this._swap_widget.setToggleState(this._swap_box.visible);
	this._cpu_box.visible = this._schema.get_boolean("cpu-display");
	this._cpu_widget.setToggleState(this._cpu_box.visible);

	this._schema.connect('changed::memory-display',
                             Lang.bind(this,
                                       function () {
		                           this._mem_box.visible = this._schema.get_boolean("memory-display");
		                           this._mem_widget.setToggleState(this._mem_box.visible);
	                               }));
	this._schema.connect('changed::swap-display',
                             Lang.bind(this,
                                       function () {
		                           this._swap_box.visible = this._schema.get_boolean("swap-display");
		                           this._swap_widget.setToggleState(this._swap_box.visible);
	                               }));
	this._schema.connect('changed::cpu-display',
                             Lang.bind(this,
                                       function () {
		                           this._cpu_box.visible = this._schema.get_boolean("cpu-display");
		                           this._cpu_widget.setToggleState(this._cpu_box.visible);
	                               }));

        if(this._schema.get_boolean("center-display")) {
	    Main.panel._centerBox.add(this.actor);
        }

	this._update_mem_swap();
	this._update_cpu();

        GLib.timeout_add(0, 10000,
                         Lang.bind(this, function () {
                                       this._update_mem_swap();
                                       return true;
                                   }));
        GLib.timeout_add(0, 1500,
                         Lang.bind(this, function () {
                                       this._update_cpu();
                                       return true;
                                   }));
    },

    _update_mem_swap: function() {
        let meminfo = GLib.file_get_contents('/proc/meminfo');
        if(meminfo[0]) {
            let meminfo_lines = meminfo[1].split("\n");

            let memtotal_line = meminfo_lines[0].replace(/ +/g, " ").split(" ");
            let memfree_line = meminfo_lines[1].replace(/ +/g, " ").split(" ");
            let buffers_line = meminfo_lines[2].replace(/ +/g, " ").split(" ");
            let cached_line = meminfo_lines[3].replace(/ +/g, " ").split(" ");
            if( memtotal_line[0] != "MemTotal:" || memfree_line[0] != "MemFree:" || buffers_line[0] != "Buffers:" || cached_line[0] != "Cached:") {
                global.log("Error reading memory in /proc/meminfo");
                return;
            }
            let mem_total = Math.round(memtotal_line[1] / 1024);
            let mem_free = Math.round(memfree_line[1] / 1024);
            let buffers = Math.round(buffers_line[1] / 1024);
            let cached = Math.round(cached_line[1] / 1024);
            let mem_used = mem_total - mem_free - buffers -cached;
            let mem_percentage = Math.round(100 * mem_used / mem_total);
            this._mem_.set_text(" " + mem_percentage + "%");
            this._mem.set_text(mem_used.toString());
            this._mem_total.set_text(mem_total.toString());

            let swaptotal_line = meminfo_lines[13].replace(/ +/g, " ").split(" ");
            let swapfree_line = meminfo_lines[14].replace(/ +/g, " ").split(" ");
            if(swaptotal_line[0] != "SwapTotal:" || swapfree_line[0] != "SwapFree:") {
                global.log("Error reading swap in /proc/meminfo");
                return;
            }
            let swap_total = Math.round(swaptotal_line[1] / 1024);
            let swap_free = Math.round(swapfree_line[1] / 1024);
            let swap_used = swap_total - swap_free;
            let swap_percentage = Math.round(100 * swap_used / swap_total);
            this._swap_.set_text(" " + swap_percentage + "%");
            this._swap.set_text(swap_used.toString());
            this._swap_total.set_text(swap_total.toString());

        } else {
	    global.log("system-monitor: reading /proc/meminfo gave an error");
	}
    },

    _update_cpu: function() {
        let stat = GLib.file_get_contents('/proc/stat');
        if(stat[0]) {
            let stat_lines = stat[1].split("\n");
	    let cpu_params = stat_lines[1].replace(/ +/g, " ").split(" ");
	    let idle = parseInt(cpu_params[4]);
	    let total = parseInt(cpu_params[1]) + parseInt(cpu_params[2]) + parseInt(cpu_params[3]) + parseInt(cpu_params[4]);
	    let time = GLib.get_monotonic_time() / 1000;
	    if(this.__last_cpu_time != 0) {
		let delta = time - this.__last_cpu_time;
		let cpu_usage = (100 - Math.round(100 * (idle - this.__last_cpu_idle) / (total - this.__last_cpu_total)));
		this._cpu_.set_text(' ' + cpu_usage + '%');
		this._cpu.set_text(cpu_usage.toString());
	    }
	    this.__last_cpu_idle = idle;
	    this.__last_cpu_total = total;
	    this.__last_cpu_time = time;
        } else {
	    global.log("system-monitor: reading /proc/stat gave an error");
	}
    },

    _onDestroy: function() {}
};


function main() {
    Panel.STANDARD_TRAY_ICON_ORDER.unshift('system-monitor');
    Panel.STANDARD_TRAY_ICON_SHELL_IMPLEMENTATION['system-monitor'] = SystemMonitor;
}
