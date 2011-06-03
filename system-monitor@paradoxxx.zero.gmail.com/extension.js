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
const Util = imports.misc.util;

function Open_Window() {
    Util.spawn(["gnome-system-monitor"]);
}

function Cpu_State() {
    this._init();
}

Cpu_State.prototype = {
    _init: function() {
        this.last = [0,0,0,0,0];
        this.last_total = 0;
        this.usage = [0,0,0,1,0];
        this.update();
    },
    update: function() {
        let stat = GLib.file_get_contents('/proc/stat');
        let accum = [0,0,0,0,0];
        let total_t = 0;
        if(stat[0]) {
            let stat_lines = stat[1].split("\n");
            let cpu_params = stat_lines[0].replace(/ +/g, " ").split(" ");
            for (let i = 1;i <= 5;i++) {
                accum[i - 1] = parseInt(cpu_params[i]);
            }
            for (let i = 1;i < cpu_params.length;i++) {
                let tmp = parseInt(cpu_params[i]);
                if (tmp > 0) total_t += tmp;
            }
        } else {
            global.log("system-monitor: reading /proc/stat gave an error");
        }
        let total = total_t - this.last_total;
        if (total > 0) {
            for (let i = 0;i < 5;i++) {
                this.usage[i] = (accum[i] - this.last[i]) / total;
            }
            for (let i = 0;i < 5;i++) {
                this.last[i] = accum[i];
            }
            this.last_total = total_t;
        }
    },
    precent: function() {
        return Math.round((1 - this.usage[3]) * 100);
    }
}

function Mem_Swap() {
    this._init();
}

Mem_Swap.prototype = {
    _init: function() {
        this.update();
    },
    update: function() {
        this.mem = [0,0,0];
        this.mem_total = 0;
        this.swap = 0;
        this.swap_total = 0;
        let meminfo = GLib.file_get_contents('/proc/meminfo');
        let mem_free = 0;
        let swap_free = 0;
        if(meminfo[0]) {
            let meminfo_lines = meminfo[1].split("\n");
            for(let i = 0 ; i < meminfo_lines.length ; i++) {
                let line = meminfo_lines[i].replace(/ +/g, " ").split(" ");
                switch(line[0]) {
                case "MemTotal:":
                    this.mem_total = Math.round(line[1] / 1024);
                    break;
                case "MemFree:":
                    mem_free = Math.round(line[1] / 1024);
                    break;
                case "Buffers:":
                    this.mem[1] = Math.round(line[1] / 1024);
                    break;
                case "Cached:":
                    this.mem[2] = Math.round(line[1] / 1024);
                    break;
                case "SwapTotal:":
                    this.swap_total = Math.round(line[1] / 1024);
                    break;
                case "SwapFree:":
                    swap_free = Math.round(line[1] / 1024);
                    break;
                }
            }
            this.mem[0] = this.mem_total - this.mem[1] - this.mem[2] - mem_free;
            this.swap = this.swap_total - swap_free;
        } else {
            global.log("system-monitor: reading /proc/meminfo gave an error");
        }
    },
    swap_precent: function() {
        if (this.swap_total == 0) {
            return 0;
        } else {
            return Math.round(this.swap / this.swap_total * 100);
        }
    },
    mem_precent: function() {
        if (this.mem_total == 0) {
            return 0;
        } else {
            return Math.round(this.mem[0] / this.mem_total * 100);
        }
    }
}

function Net_State() {
    this._init();
}

Net_State.prototype = {
    _init: function() {
        this.last = [0,0];
        this.usage = [0,0];
        this.last_time = 0;
        this.update();
    },
    update: function() {
        let net = GLib.file_get_contents('/proc/net/dev');
        let accum = [0,0];
        let time = 0;
        if(net[0]) {
            let net_lines = net[1].split("\n");
            for(let i = 3; i < net_lines.length - 1 ; i++) {
                let net_params = net_lines[i].replace(/ +/g, " ").split(" ");
                accum[0] += parseInt(net_params[2]);
                accum[1] += parseInt(net_params[10]);
            }
            time = GLib.get_monotonic_time() / 1000;
        } else {
            global.log("system-monitor: reading /proc/net/dev gave an error");
        }
        let delta = time - this.last_time;
        if (delta > 0) {
            for (let i = 0;i < 2;i++) {
                this.usage[i] = Math.round((accum[i] - this.last[i]) / delta);
                this.last[i] = accum[i];
            }
        }
        this.last_time = time;
    }
}

function Chart() {
    this._init.apply(this, arguments);
}

Chart.prototype = {
    _init: function() {
        //if (arguments.length != 3) return; //TODO
        this.actor = new St.DrawingArea({ style_class: "sm-chart", reactive: true});
        this.actor.connect('repaint', Lang,bind(this, this._draw));
        this._rcolor(arguments[0]);
        this.data = [];
    },
    _rcolor: function(color_s) {
        this.colors = [];
        for (let i = 0;i < color_s.length;i++) {
            this.colors[i] = new Clutter.Color();
            colors[i].from_string(color_s[i]);
        }
    },
    _draw: function() {
        let [width, height] = this.actor.get_surface_size();
        let cr = this.actor.get_context();
        for (let i = this.colors.length - 1;i >= 0;i--) {
            cr.moveTo(0, height);
            let j;
            for (j = 0;j < this.data.length;j++) {
                cr.lineTo(j, (1 - this.data[j][i]) * height);
            }
            cr.lineTo(j, height);
            cr.lineTo(0, height);
            cr.closePath();
            Clutter.cairo_set_source_color(cr, color);
            cr.fill();
        }
    },
    _addValue: function(data_a) {
        let [width, height] = this.actor.get_surface_size();
        let accdata = [];
        for (let i = 0;i < data_a.length;i++) {
            accdata[i] = (i == 0) ? data_a[0] : accdata[i - i] + (data_a[i] > 0) ? data_a[i] : 0;
        }
        this.data.push(accdata);
        while (this.data.push.length > width)
            this.data.shift();
    }
}

function SystemMonitor() {
    this._init.apply(this, arguments);
}

SystemMonitor.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,
    icon_size: Math.round(Panel.PANEL_ICON_SIZE * 4 / 5),

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
        item.connect('activate', Open_Window);
        section.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem("Swap");
        this._swap = new St.Label({ style_class: "sm-value"});
        this._swap_total = new St.Label({ style_class: "sm-value"});
        item.addActor(new St.Label({ text:':', style_class: "sm-label"}));
        item.addActor(this._swap);
        item.addActor(new St.Label({ text: "/", style_class: "sm-label"}));
        item.addActor(this._swap_total);
        item.addActor(new St.Label({ text: "M", style_class: "sm-label"}));
        item.connect('activate', Open_Window);
        section.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem("Cpu");
        item.addActor(new St.Label({ text:':', style_class: "sm-label"}));
        this._cpu = new St.Label({ style_class: "sm-value"});
        item.addActor(new St.Label({ style_class: "sm-void"}));
        item.addActor(new St.Label({ style_class: "sm-void"}));
        item.addActor(this._cpu);
        item.addActor(new St.Label({ text:'%', style_class: "sm-label"}));
        item.connect('activate', Open_Window);
        section.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem("Net");
        item.addActor(new St.Label({ text:':', style_class: "sm-label"}));
        this._netdown = new St.Label({ style_class: "sm-value"});
        item.addActor(this._netdown);
        item.addActor(new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: 16, icon_name:'go-down'}));
        this._netup = new St.Label({ style_class: "sm-value"});
        item.addActor(this._netup);
        item.addActor(new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: 16, icon_name:'go-up'}));
        item.connect('activate', Open_Window);
        section.addMenuItem(item);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        section = new PopupMenu.PopupMenuSection("Toggling");
        this.menu.addMenuItem(section);
        this._mem_widget = new PopupMenu.PopupSwitchMenuItem("Display memory", true);
        this._mem_widget.connect(
            'toggled',
            Lang.bind(this,
                      function(item) {
                          this._mem_box.visible = item.state;
                          if(this._schema) {
                              this._schema.set_boolean("memory-display", item.state);
                          }
                      }));
        section.addMenuItem(this._mem_widget);
        this._swap_widget = new PopupMenu.PopupSwitchMenuItem("Display swap", true);
        this._swap_widget.connect(
            'toggled',
            Lang.bind(this,
                      function(item) {
                          this._swap_box.visible = item.state;
                          if(this._schema) {
                              this._schema.set_boolean("swap-display", item.state);
                          }
                      }));
        section.addMenuItem(this._swap_widget);
        this._cpu_widget = new PopupMenu.PopupSwitchMenuItem("Display cpu", true);
        this._cpu_widget.connect(
            'toggled',
            Lang.bind(this,
                      function(item) {
                          this._cpu_box.visible = item.state;
                          if(this._schema) {
                              this._schema.set_boolean("cpu-display", item.state);
                          }
                      }));
        section.addMenuItem(this._cpu_widget);
        this._net_widget = new PopupMenu.PopupSwitchMenuItem("Display net", true);
        this._net_widget.connect(
            'toggled',
            Lang.bind(this,
                      function(item) {
                          this._net_box.visible = item.state;
                          if(this._schema) {
                              this._schema.set_boolean("net-display", item.state);
                          }
                      }));
        section.addMenuItem(this._net_widget);
    },
    _init_status: function() {
        let box = new St.BoxLayout();
        this._icon_ = new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: this.icon_size, icon_name:'utilities-system-monitor'});
        this._mem_ = new St.Label({ style_class: "sm-status-value"});
        this._swap_ = new St.Label({ style_class: "sm-status-value"});
        this._cpu_ = new St.Label({ style_class: "sm-status-value"});
        this._netdown_ = new St.Label({ style_class: "sm-big-status-value"});
        this._netup_ = new St.Label({ style_class: "sm-big-status-value"});

        box.add_actor(this._icon_);

        this._mem_box = new St.BoxLayout();
        this._mem_box.add_actor(new St.Label({ text: 'mem', style_class: "sm-status-label"}));
        this._mem_box.add_actor(this._mem_);
        this._mem_box.add_actor(new St.Label({ text: '%', style_class: "sm-perc-label"}));
        box.add_actor(this._mem_box);

        this._swap_box = new St.BoxLayout();
        this._swap_box.add_actor(new St.Label({ text: 'swap', style_class: "sm-status-label"}));
        this._swap_box.add_actor(this._swap_);
        this._swap_box.add_actor(new St.Label({ text: '%', style_class: "sm-perc-label"}));
        box.add_actor(this._swap_box);

        this._cpu_box = new St.BoxLayout();
        this._cpu_box.add_actor(new St.Label({ text: 'cpu', style_class: "sm-status-label"}));
        this._cpu_box.add_actor(this._cpu_);
        this._cpu_box.add_actor(new St.Label({ text: '%', style_class: "sm-perc-label"}));
        box.add_actor(this._cpu_box);

        this._net_box = new St.BoxLayout();
        this._net_box.add_actor(new St.Label({ text: 'net', style_class: "sm-status-label"}));
        this._net_box.add_actor(new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: 2 * this.icon_size / 3, icon_name:'go-down'}));
        this._net_box.add_actor(this._netdown_);
        this._net_box.add_actor(new St.Label({ text: 'kB/s', style_class: "sm-unit-label"}));
        this._net_box.add_actor(new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: 2 * this.icon_size / 3, icon_name:'go-up'}));
        this._net_box.add_actor(this._netup_);
        this._net_box.add_actor(new St.Label({ text: 'kB/s', style_class: "sm-unit-label"}));
        box.add_actor(this._net_box);

        this.actor.set_child(box);
    },
    _init: function() {
        Panel.__system_monitor = this;
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'utilities-system-monitor', 'System monitor');

        this._init_status();
        this._schema = false;
        this._init_menu();

        this._schema = new Gio.Settings({ schema: 'org.gnome.shell.extensions.system-monitor' });
        this._icon_.visible = this._schema.get_boolean("icon-display");
        this._mem_box.visible = this._schema.get_boolean("memory-display");
        this._mem_widget.setToggleState(this._mem_box.visible);
        this._swap_box.visible = this._schema.get_boolean("swap-display");
        this._swap_widget.setToggleState(this._swap_box.visible);
        this._cpu_box.visible = this._schema.get_boolean("cpu-display");
        this._cpu_widget.setToggleState(this._cpu_box.visible);
        this._net_box.visible = this._schema.get_boolean("net-display");
        this._net_widget.setToggleState(this._net_box.visible);

        this._schema.connect(
            'changed::icon-display',
            Lang.bind(this,
                      function () {
                          this._icon_.visible = this._schema.get_boolean("icon-display");
                      }));
        this._schema.connect(
            'changed::swap-display',
            Lang.bind(this,
                      function () {
                          this._swap_box.visible = this._schema.get_boolean("swap-display");
                          this._swap_widget.setToggleState(this._swap_box.visible);
                      }));
        this._schema.connect(
            'changed::cpu-display',
            Lang.bind(this,
                      function () {
                          this._cpu_box.visible = this._schema.get_boolean("cpu-display");
                          this._cpu_widget.setToggleState(this._cpu_box.visible);
                      }));
        this._schema.connect(
            'changed::net-display',
            Lang.bind(this,
                      function () {
                          this._net_box.visible = this._schema.get_boolean("net-display");
                          this._net_widget.setToggleState(this._net_box.visible);
                      }));
        if(this._schema.get_boolean("center-display")) {
            Main.panel._centerBox.add(this.actor);
        }

        this.cpu = new Cpu_State();
        this.mem_swap = new Mem_Swap();
        this.net = new Net_State();

        this._update_mem_swap();
        this._update_cpu();
        this._update_net();

        this.mem_swap_interv = 4000;
        this.cpu_interv = 1500;
        this.net_interv = 1000;

        GLib.timeout_add(0, this.mem_swap_interv,
                         Lang.bind(this,
                                   function () {
                                       this._update_mem_swap();
                                       return true;
                                   }));
        GLib.timeout_add(0, this.cpu_interv,
                         Lang.bind(this,
                                   function () {
                                       this._update_cpu();
                                       return true;
                                   }));
        GLib.timeout_add(0, this.net_interv,
                         Lang.bind(this,
                                   function () {
                                       this._update_net();
                                       return true;
                                   }));
    },

    _update_mem_swap: function() {
        this.mem_swap.update();
        this._mem_.set_text(this.mem_swap.mem_precent().toString());
        this._mem.set_text(this.mem_swap.mem[0].toString());
        this._mem_total.set_text(this.mem_swap.mem_total.toString());
        this._swap_.set_text(this.mem_swap.swap_precent().toString());
        this._swap.set_text(this.mem_swap.swap.toString());
        this._swap_total.set_text(this.mem_swap.swap_total.toString());
    },

    _update_cpu: function() {
        this.cpu.update();
        this._cpu_.set_text(this.cpu.precent().toString());
        this._cpu.set_text(this.cpu.precent().toString());
    },

    _update_net: function() {
        this.net.update();
        this._netdown_.set_text(this.net.usage[0].toString());
        this._netup_.set_text(this.net.usage[1].toString());
        this._netdown.set_text(this.net.usage[0] + " kB/s");
        this._netup.set_text(this.net.usage[1] + " kB/s");
    },

    _onDestroy: function() {}
};


function main() {
    Panel.STANDARD_TRAY_ICON_ORDER.unshift('system-monitor');
    Panel.STANDARD_TRAY_ICON_SHELL_IMPLEMENTATION['system-monitor'] = SystemMonitor;
}
