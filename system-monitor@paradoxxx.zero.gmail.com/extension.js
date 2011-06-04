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
const Clutter = imports.gi.Clutter;

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
    },
    list: function() {
        let free = 1;
        for (let i = 0;i < this.usage.length;i++) {
            free -= this.usage[i];
        }
        return [this.usage[0], this.usage[1], this.usage[2], this.usage[4], free];
    }
};

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
    swap_list: function() {
        return [this.swap / this.swap_total];
    },
    mem_precent: function() {
        if (this.mem_total == 0) {
            return 0;
        } else {
            return Math.round(this.mem[0] / this.mem_total * 100);
        }
    },
    mem_list: function() {
        let mem = [];
        for (let i = 0;i < this.mem.length;i++) {
            mem[i] = this.mem[i] / this.mem_total;
        }
        return mem;
    }
};

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
    },
    list: function() {
        return this.usage;
    }
};

function Disk_IO() {
    this._init();
}

Disk_IO.prototype = {
    _init: function() {
        this.last = [0,0];
        this.usage = [0,0];
        this.last_time = 0;
        this.update();
    },
    update: function() {
        let diskio = GLib.file_get_contents('/proc/diskstats');
        let accum = [0,0];
        let time = 0;
        if(diskio[0]) {
            let diskio_lines = diskio[1].split("\n");
            for(let i = 0;i < diskio_lines.length - 1;i++) {
                let diskio_params = diskio_lines[i].replace(/ +/g, " ").replace(/^ /,"").split(" ");
                if (/[0-9]$/.test(diskio_params[2])) continue;
                accum[0] += parseInt(diskio_params[6]);
                accum[1] += parseInt(diskio_params[10]);
            }
            time = GLib.get_monotonic_time() / 1000;
        } else {
            global.log("system-monitor: reading /proc/diskstats gave an error");
        }
        let delta = time - this.last_time;
        if (delta > 0) {
            for (let i = 0;i < 2;i++) {
                this.usage[i] = (accum[i] - this.last[i]) / delta;
                this.last[i] = accum[i];
            }
        }
        this.last_time = time;
    },//I don't think this is the best way to gather statistics
    precent: function() {
        return [Math.round(this.usage[0] * 100), Math.round(this.usage[1] * 100)];
    },
    list: function() {
        return this.usage;
    }
};

function Chart() {
    this._init.apply(this, arguments);
}

Chart.prototype = {
    _init: function() {
        //if (arguments.length != 3) return; //TODO
        this.actor = new St.DrawingArea({ style_class: "sm-chart", reactive: true});
        this.actor.connect('repaint', Lang.bind(this, this._draw));
        this._rcolor(arguments[0]);
        this._bk_grd(arguments[1]);
        this.data = [];
        for (let i = 0;i < this.colors.length;i++) {
            this.data[i] = [];
        }
    },
    _rcolor: function(color_s) {
        this.colors = [];
        for (let i = 0;i < color_s.length;i++) {
            this.colors[i] = new Clutter.Color();
            this.colors[i].from_string(color_s[i]);
        }
    },
    _bk_grd: function(background) {
        this.background = background;
    },
    _draw: function() {
        if (!this.actor.visible) return;
        let [width, height] = this.actor.get_surface_size();
        let cr = this.actor.get_context();
        let max = Math.max.apply(this,this.data[this.data.length - 1]);
        if (max <= 1) {
            max = 1;
        } else {
            max = Math.pow(2, Math.ceil(Math.log(max) / Math.log(2)));
        }
        let back_color = new Clutter.Color();
        back_color.from_string(this.background);
        Clutter.cairo_set_source_color(cr, back_color);
        cr.rectangle(0, 0, width, height);
        cr.fill();
        for (let i = this.colors.length - 1;i >= 0;i--) {
            cr.moveTo(0, height);
            for (let j = this.data[i].length - 1;j >= 0;j--) {
                cr.lineTo(this.data[i].length - 1 - j, (1 - this.data[i][j] / max) * height);
            }
            cr.lineTo(this.data[i].length - 1, height);
            cr.lineTo(0, height);
            cr.closePath();
            Clutter.cairo_set_source_color(cr, this.colors[i]);
            cr.fill();
        }
    },
    _addValue: function(data_a) {
        if (data_a.length != this.colors.length) return;
        let width = 30;//TODO: this.actor.get_width();
        let accdata = [];
        for (let i = 0;i < data_a.length;i++) {
            accdata[i] = (i == 0) ? data_a[0] : accdata[i - 1] + ((data_a[i] > 0) ? data_a[i] : 0);
            this.data[i].push(accdata[i]);
            if (this.data[i].length > width)
                this.data[i].shift();
        }
        this.actor.queue_repaint();
    }
};

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

        item = new PopupMenu.PopupMenuItem("DiskIO");
        item.addActor(new St.Label({ text:':', style_class: "sm-label"}));
        this._diskread = new St.Label({ style_class: "sm-value"});
        item.addActor(this._diskread);
        item.addActor(new St.Label({ text:'R', style_class: "sm-label"}));
        this._diskwrite = new St.Label({ style_class: "sm-value"});
        item.addActor(this._diskwrite);
        item.addActor(new St.Label({ text:'W', style_class: "sm-label"}));
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
        this._diskio_widget = new PopupMenu.PopupSwitchMenuItem("Display DiskIO", true);
        this._diskio_widget.connect(
            'toggled',
            Lang.bind(this,
                      function(item) {
                          this._diskio_box.visible = item.state;
                          if(this._schema) {
                              this._schema.set_boolean("diskio-display", item.state);
                          }
                      }));
        section.addMenuItem(this._diskio_widget);
    },
    _init_status: function() {
        let box = new St.BoxLayout();
        this._icon_ = new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: this.icon_size, icon_name:'utilities-system-monitor'});
        this._mem_ = new St.Label({ style_class: "sm-status-value"});
        this._swap_ = new St.Label({ style_class: "sm-status-value"});
        this._cpu_ = new St.Label({ style_class: "sm-status-value"});
        this._netdown_ = new St.Label({ style_class: "sm-big-status-value"});
        this._netup_ = new St.Label({ style_class: "sm-big-status-value"});
        this._diskread_ = new St.Label({ style_class: "sm-big-status-value"});
        this._diskwrite_ = new St.Label({ style_class: "sm-big-status-value"});

        let background = this._schema.get_string('background')

        let colors = [];
        colors.push(this._schema.get_string('memory-user-color'));
        colors.push(this._schema.get_string('memory-buffer-color'));
        colors.push(this._schema.get_string('memory-cache-color'));
        this._mem_chart_ = new Chart(colors, background);

        let mem_color = function() {
            let colors = [];
            colors.push(this._schema.get_string('memory-user-color'));
            colors.push(this._schema.get_string('memory-buffer-color'));
            colors.push(this._schema.get_string('memory-cache-color'));
            let background = this._schema.get_string('background')
            this._mem_chart_._rcolor(colors);
            this._mem_chart_._bk_grd(background)
            this._mem_chart_.actor.queue_repaint();
            return true;
        }

        this._schema.connect('changed::memory-user-color', Lang.bind(this, mem_color));
        this._schema.connect('changed::memory-buffer-color', Lang.bind(this, mem_color));
        this._schema.connect('changed::memory-cache-color', Lang.bind(this, mem_color));
        this._schema.connect('changed::background', Lang.bind(this, mem_color));

        colors = [];
        colors.push(this._schema.get_string('net-down-color'));
        colors.push(this._schema.get_string('net-up-color'));
        this._net_chart_ = new Chart(colors, background);

        let net_color = function() {
            let colors = [];
            colors.push(this._schema.get_string('net-down-color'));
            colors.push(this._schema.get_string('net-up-color'));
            let background = this._schema.get_string('background')
            this._net_chart_._rcolor(colors);
            this._net_chart_._bk_grd(background)
            this._net_chart_.actor.queue_repaint();
            return true;
        }

        this._schema.connect('changed::net-down-color', Lang.bind(this, net_color));
        this._schema.connect('changed::net-up-color', Lang.bind(this, net_color));
        this._schema.connect('changed::background', Lang.bind(this, net_color));

        colors = [];
        colors.push(this._schema.get_string('swap-used-color'));
        this._swap_chart_ = new Chart(colors, background);

        let swap_color = function() {
            let colors = [];
            colors.push(this._schema.get_string('swap-used-color'));
            let background = this._schema.get_string('background')
            this._net_chart_._rcolor(colors);
            this._net_chart_._bk_grd(background)
            this._net_chart_.actor.queue_repaint();
            return true;
        }

        this._schema.connect('changed::swap-used-color', Lang.bind(this, swap_color));
        this._schema.connect('changed::background', Lang.bind(this, swap_color));

        colors = [];
        colors.push(this._schema.get_string('cpu-user-color'));
        colors.push(this._schema.get_string('cpu-system-color'));
        colors.push(this._schema.get_string('cpu-nice-color'));
        colors.push(this._schema.get_string('cpu-iowait-color'));
        colors.push(this._schema.get_string('cpu-other-color'));
        this._cpu_chart_ = new Chart(colors, background);

        let cpu_color = function() {
            let colors = [];
            colors.push(this._schema.get_string('cpu-user-color'));
            colors.push(this._schema.get_string('cpu-system-color'));
            colors.push(this._schema.get_string('cpu-nice-color'));
            colors.push(this._schema.get_string('cpu-iowait-color'));
            colors.push(this._schema.get_string('cpu-other-color'));
            let background = this._schema.get_string('background')
            this._cpu_chart_._rcolor(colors);
            this._cpu_chart_._bk_grd(background)
            this._cpu_chart_.actor.queue_repaint();
            return true;
        }

        this._schema.connect('changed::cpu-user-color', Lang.bind(this, cpu_color));
        this._schema.connect('changed::cpu-system-color', Lang.bind(this, cpu_color));
        this._schema.connect('changed::cpu-nice-color', Lang.bind(this, cpu_color));
        this._schema.connect('changed::cpu-iowait-color', Lang.bind(this, cpu_color));
        this._schema.connect('changed::cpu-other-color', Lang.bind(this, cpu_color));
        this._schema.connect('changed::background', Lang.bind(this, cpu_color));

        colors = [];
        colors.push(this._schema.get_string('disk-read-color'));
        colors.push(this._schema.get_string('disk-write-color'));
        this._diskio_chart_ = new Chart(colors, background);

        let diskio_color = function() {
            let colors = [];
            colors.push(this._schema.get_string('disk-read-color'));
            colors.push(this._schema.get_string('disk-write-color'));
            let background = this._schema.get_string('background')
            this._diskio_chart_._rcolor(colors);
            this._diskio_chart_._bk_grd(background)
            this._diskio_chart_.actor.queue_repaint();
            return true;
        }

        this._schema.connect('changed::disk-read-color', Lang.bind(this, diskio_color));
        this._schema.connect('changed::disk-write-color', Lang.bind(this, diskio_color));
        this._schema.connect('changed::background', Lang.bind(this, diskio_color));

        box.add_actor(this._icon_);

        let text_disp = function(text, schema) {
            let apply = function() {
                text.visible = this._schema.get_boolean(schema);
            };
            Lang.bind(this, apply)();
            this._schema.connect('changed::' + schema, Lang.bind(this, apply));
        }

        let disp_style = function(digits, chart, schema) {
            let apply = function() {
                let d_digit = false, d_chart = false;
                let style = this._schema.get_string(schema);
                if (style == 'digit' || style == 'both') d_digit = true;
                if (style == 'graph' || style == 'both') d_chart = true;
                for (let i = 0;i < digits.length;i++) {
                    digits[i].visible = d_digit;
                }
                chart.visible = d_chart;
            }
            Lang.bind(this, apply)();
            this._schema.connect('changed::' + schema, Lang.bind(this, apply));
        }

        let text, digits = [], digit;
        this._mem_box = new St.BoxLayout();
        text = new St.Label({ text: 'mem', style_class: "sm-status-label"});
        Lang.bind(this, text_disp)(text, 'memory-show-text');
        this._mem_box.add_actor(text);
        this._mem_box.add_actor(this._mem_);
        digits.push(this._mem_);
        digit = new St.Label({ text: '%', style_class: "sm-perc-label"});
        this._mem_box.add_actor(digit);
        digits.push(digit);
        this._mem_box.add_actor(this._mem_chart_.actor);
        Lang.bind(this, disp_style)(digits, this._mem_chart_.actor, 'memory-style');
        box.add_actor(this._mem_box);

        digits = [];
        this._swap_box = new St.BoxLayout();
        text = new St.Label({ text: 'swap', style_class: "sm-status-label"});
        Lang.bind(this, text_disp)(text, 'swap-show-text');
        this._swap_box.add_actor(text);
        this._swap_box.add_actor(this._swap_);
        digits.push(this._swap_);
        digit = new St.Label({ text: '%', style_class: "sm-perc-label"});
        this._swap_box.add_actor(digit);
        digits.push(digit);
        this._swap_box.add_actor(this._swap_chart_.actor);
        Lang.bind(this, disp_style)(digits, this._swap_chart_.actor, 'swap-style');
        box.add_actor(this._swap_box);

        digits = [];
        this._cpu_box = new St.BoxLayout();
        text = new St.Label({ text: 'cpu', style_class: "sm-status-label"});
        Lang.bind(this, text_disp)(text, 'cpu-show-text');
        this._cpu_box.add_actor(text);
        this._cpu_box.add_actor(this._cpu_);
        digits.push(this._cpu_);
        digit = new St.Label({ text: '%', style_class: "sm-perc-label"});
        this._cpu_box.add_actor(digit);
        digits.push(digit);
        this._cpu_box.add_actor(this._cpu_chart_.actor);
        Lang.bind(this, disp_style)(digits, this._cpu_chart_.actor, 'cpu-style');
        box.add_actor(this._cpu_box);

        digits = [];
        this._net_box = new St.BoxLayout();
        text = new St.Label({ text: 'net', style_class: "sm-status-label"});
        Lang.bind(this, text_disp)(text, 'net-show-text');
        this._net_box.add_actor(text);
        digit = new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: 2 * this.icon_size / 3, icon_name:'go-down'});
        this._net_box.add_actor(digit);
        digits.push(digit);
        this._net_box.add_actor(this._netdown_);
        digits.push(this._netdown_);
        digit = new St.Label({ text: 'kB/s', style_class: "sm-unit-label"});
        this._net_box.add_actor(digit);
        digits.push(digit);
        digit = new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: 2 * this.icon_size / 3, icon_name:'go-up'});
        this._net_box.add_actor(digit);
        digits.push(digit);
        this._net_box.add_actor(this._netup_);
        digits.push(this._netup_);
        digit = new St.Label({ text: 'kB/s', style_class: "sm-unit-label"});
        this._net_box.add_actor(digit);
        digits.push(digit);
        this._net_box.add_actor(this._net_chart_.actor);
        Lang.bind(this, disp_style)(digits, this._net_chart_.actor, 'net-style');
        box.add_actor(this._net_box);

        digits = [];
        this._diskio_box = new St.BoxLayout();
        text = new St.Label({ text: 'diskio', style_class: "sm-status-label"});
        Lang.bind(this, text_disp)(text, 'diskio-show-text');
        this._diskio_box.add_actor(text);
        digit = new St.Label({ text: 'R', style_class: "sm-status-label"});
        this._diskio_box.add_actor(digit);
        digits.push(digit);
        this._diskio_box.add_actor(this._diskread_);
        digits.push(this._diskread_);
        digit = new St.Label({ text: '%', style_class: "sm-perc-label"});
        this._diskio_box.add_actor(digit);
        digits.push(digit);
        digit = new St.Label({ text: 'W', style_class: "sm-status-label"});
        this._diskio_box.add_actor(digit);
        digits.push(digit);
        this._diskio_box.add_actor(this._diskwrite_);
        digits.push(this._diskwrite_);
        digit = new St.Label({ text: '%', style_class: "sm-perc-label"});
        this._diskio_box.add_actor(digit);
        digits.push(digit);
        this._diskio_box.add_actor(this._diskio_chart_.actor);
        Lang.bind(this, disp_style)(digits, this._diskio_chart_.actor, 'diskio-style');
        box.add_actor(this._diskio_box);

        this.actor.set_child(box);
    },
    _init: function() {
        Panel.__system_monitor = this;
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'utilities-system-monitor', 'System monitor');

        this._schema = new Gio.Settings({ schema: 'org.gnome.shell.extensions.system-monitor' });

        this._init_status();
        this._init_menu();

        this._icon_.visible = this._schema.get_boolean("icon-display");
        this._mem_box.visible = this._schema.get_boolean("memory-display");
        this._mem_widget.setToggleState(this._mem_box.visible);
        this._swap_box.visible = this._schema.get_boolean("swap-display");
        this._swap_widget.setToggleState(this._swap_box.visible);
        this._cpu_box.visible = this._schema.get_boolean("cpu-display");
        this._cpu_widget.setToggleState(this._cpu_box.visible);
        this._net_box.visible = this._schema.get_boolean("net-display");
        this._net_widget.setToggleState(this._net_box.visible);
        this._diskio_box.visible = this._schema.get_boolean("diskio-display");
        this._diskio_widget.setToggleState(this._diskio_box.visible);

        this._schema.connect(
            'changed::icon-display',
            Lang.bind(this,
                      function () {
                          this._icon_.visible = this._schema.get_boolean("icon-display");
                      }));
        this._schema.connect(
            'changed::memory-display',
            Lang.bind(this,
                      function () {
                          this._mem_box.visible = this._schema.get_boolean("memory-display");
                          this._mem_widget.setToggleState(this._mem_box.visible);
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
        this._schema.connect(
            'changed::diskio-display',
            Lang.bind(this,
                      function () {
                          this._diskio_box.visible = this._schema.get_boolean("diskio-display");
                          this._diskio_widget.setToggleState(this._diskio_box.visible);
                      }));

        if(this._schema.get_boolean("center-display")) {
            Main.panel._centerBox.add(this.actor);
        }

        this.cpu = new Cpu_State();
        this.mem_swap = new Mem_Swap();
        this.net = new Net_State();
        this.diskio = new Disk_IO();

        this._update_mem_swap();
        this._update_cpu();
        this._update_net();
        this._update_diskio();

        l_limit = function(a) {
            return (a > 100) ? a : 100;
        };

        this.mem_interv = l_limit(this._schema.get_int("memory-refresh-time"));
        this.cpu_interv = l_limit(this._schema.get_int("cpu-refresh-time"));
        this.net_interv = l_limit(this._schema.get_int("net-refresh-time"));
        this.diskio_interv = l_limit(this._schema.get_int("diskio-refresh-time"));

        this.mem_update_fun = Lang.bind(this,
                                         function () {
                                             this._update_mem_swap();
                                             return true;
                                         });

        this.cpu_update_fun = Lang.bind(this,
                                        function () {
                                            this._update_cpu();
                                            return true;
                                        });

        this.net_update_fun = Lang.bind(this,
                                        function () {
                                            this._update_net();
                                            return true;
                                        });
        this.diskio_update_fun = Lang.bind(this,
                                        function () {
                                            this._update_diskio();
                                            return true;
                                        });

        this.mem_timeout = GLib.timeout_add(0, this.mem_interv, this.mem_update_fun);
        this.cpu_timeout = GLib.timeout_add(0, this.cpu_interv, this.cpu_update_fun);
        this.net_timeout = GLib.timeout_add(0, this.net_interv, this.net_update_fun);
        this.net_timeout = GLib.timeout_add(0, this.diskio_interv, this.diskio_update_fun);

        this._schema.connect(
            'changed::memory-refresh-time',
            Lang.bind(this,
                      function () {
                          GLib.source_remove(this.mem_timeout);
                          this.mem_interv = Math.abs(this._schema.get_int("memory-refresh-time"));
                          this.mem_timeout = GLib.timeout_add(0, this.mem_interv, this.mem_update_fun);
                      }));
        this._schema.connect(
            'changed::cpu-refresh-time',
            Lang.bind(this,
                      function () {
                          GLib.source_remove(this.cpu_timeout);
                          this.cpu_interv = Math.abs(this._schema.get_int("cpu-refresh-time"));
                          this.cpu_timeout = GLib.timeout_add(0, this.cpu_interv, this.cpu_update_fun);
                      }));
        this._schema.connect(
            'changed::net-refresh-time',
            Lang.bind(this,
                      function () {
                          GLib.source_remove(this.net_timeout);
                          this.net_interv = Math.abs(this._schema.get_int("net-refresh-time"));
                          this.net_timeout = GLib.timeout_add(0, this.net_interv, this.net_update_fun);
                      }));
        this._schema.connect(
            'changed::diskio-refresh-time',
            Lang.bind(this,
                      function () {
                          GLib.source_remove(this.diskio_timeout);
                          this.diskio_interv = Math.abs(this._schema.get_int("diskio-refresh-time"));
                          this.diskio_timeout = GLib.timeout_add(0, this.diskio_interv, this.diskio_update_fun);
                      }));

    },

    _update_mem_swap: function() {
        this.mem_swap.update();
        this._mem_.set_text(this.mem_swap.mem_precent().toString());
        this._mem.set_text(this.mem_swap.mem[0].toString());
        this._mem_total.set_text(this.mem_swap.mem_total.toString());
        this._mem_chart_._addValue(this.mem_swap.mem_list());
        this._swap_.set_text(this.mem_swap.swap_precent().toString());
        this._swap.set_text(this.mem_swap.swap.toString());
        this._swap_total.set_text(this.mem_swap.swap_total.toString());
        this._swap_chart_._addValue(this.mem_swap.swap_list());
    },

    _update_cpu: function() {
        this.cpu.update();
        this._cpu_.set_text(this.cpu.precent().toString());
        this._cpu.set_text(this.cpu.precent().toString());
        this._cpu_chart_._addValue(this.cpu.list());
    },

    _update_net: function() {
        this.net.update();
        this._netdown_.set_text(this.net.usage[0].toString());
        this._netup_.set_text(this.net.usage[1].toString());
        this._netdown.set_text(this.net.usage[0] + " kB/s");
        this._netup.set_text(this.net.usage[1] + " kB/s");
        this._net_chart_._addValue(this.net.list());
    },

    _update_diskio: function() {
        this.diskio.update();
        let precents = this.diskio.precent();
        this._diskread_.set_text(precents[0].toString());
        this._diskwrite_.set_text(precents[1].toString());
        this._diskread.set_text(precents[0] + " %");
        this._diskwrite.set_text(precents[1] + " %");
        this._diskio_chart_._addValue(this.diskio.list());
    },

    _onDestroy: function() {}
};


function main() {
    Panel.STANDARD_TRAY_ICON_ORDER.unshift('system-monitor');
    Panel.STANDARD_TRAY_ICON_SHELL_IMPLEMENTATION['system-monitor'] = SystemMonitor;
}
