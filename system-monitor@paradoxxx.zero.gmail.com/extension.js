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
const Gettext = imports.gettext.domain('system-monitor-applet');
const _ = Gettext.gettext;

function Open_Window() {
    Util.spawn(["gnome-system-monitor"]);
}

function Open_Preference() {
    Util.spawn(["system-monitor-applet-config"]);
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
    percent: function() {
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

function Mem_State() {
    this._init();
}

Mem_State.prototype = {
    _init: function() {
        this.update();
    },
    update: function() {
        this.mem = [0,0,0];
        this.mem_total = 0;
        let meminfo = GLib.file_get_contents('/proc/meminfo');
        let mem_free = 0;
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
                }
            }
            this.mem[0] = this.mem_total - this.mem[1] - this.mem[2] - mem_free;
        } else {
            global.log("system-monitor: reading /proc/meminfo gave an error");
        }
    },
    percent: function() {
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

function Swap_State() {
    this._init();
}

Swap_State.prototype = {
    _init: function() {
        this.update();
    },
    update: function() {
        this.swap = 0;
        this.swap_total = 0;
        let meminfo = GLib.file_get_contents('/proc/meminfo');
        let swap_free = 0;
        if(meminfo[0]) {
            let meminfo_lines = meminfo[1].split("\n");
            for(let i = 0 ; i < meminfo_lines.length ; i++) {
                let line = meminfo_lines[i].replace(/ +/g, " ").split(" ");
                switch(line[0]) {
                case "SwapTotal:":
                    this.swap_total = Math.round(line[1] / 1024);
                    break;
                case "SwapFree:":
                    swap_free = Math.round(line[1] / 1024);
                    break;
                }
            }
            this.swap = this.swap_total - swap_free;
        } else {
            global.log("system-monitor: reading /proc/meminfo gave an error");
        }
    },
    percent: function() {
        if (this.swap_total == 0) {
            return 0;
        } else {
            return Math.round(this.swap / this.swap_total * 100);
        }
    },
    swap_list: function() {
        return [this.swap / this.swap_total];
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

function Disk_State() {
    this._init();
}

Disk_State.prototype = {
    _init: function() {
        this.last = [0,0];
        this.usage = [0,0];
        this.last_time = 0;
        this.update();
    },
    update: function() {
        let disk = GLib.file_get_contents('/proc/diskstats');
        let accum = [0,0];
        let time = 0;
        if(disk[0]) {
            let disk_lines = disk[1].split("\n");
            for(let i = 0;i < disk_lines.length - 1;i++) {
                let disk_params = disk_lines[i].replace(/ +/g, " ").replace(/^ /,"").split(" ");
                if (/[0-9]$/.test(disk_params[2])) continue;
                accum[0] += parseInt(disk_params[6]);
                accum[1] += parseInt(disk_params[10]);
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
    percent: function() {
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
        this.actor = new St.DrawingArea({ style_class: "sm-chart", reactive: true});
        this.width = arguments[2];
        this.height = arguments[3];
        this.actor.set_width(this.width);
        this.actor.set_height(this.height);
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
            cr.moveTo(width, height);
            for (let j = this.data[i].length - 1;j >= 0;j--) {
                cr.lineTo(width - (this.data[i].length - 1 - j), (1 - this.data[i][j] / max) * height);
            }
            cr.lineTo(width - (this.data[i].length - 1), height);
            cr.closePath();
            Clutter.cairo_set_source_color(cr, this.colors[i]);
            cr.fill();
        }
    },
    _addValue: function(data_a) {
        if (data_a.length != this.colors.length) return;
        let accdata = [];
        for (let i = 0;i < data_a.length;i++) {
            accdata[i] = (i == 0) ? data_a[0] : accdata[i - 1] + ((data_a[i] > 0) ? data_a[i] : 0);
            this.data[i].push(accdata[i]);
            if (this.data[i].length > this.width)
                this.data[i].shift();
        }
        if (arguments.length >= 2 && arguments[1] == false)
            return;
        this.actor.queue_repaint();
    }
};

function SystemMonitor() {
    this._init.apply(this, arguments);
}

SystemMonitor.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,
    icon_size: Math.round(Panel.PANEL_ICON_SIZE * 4 / 5),
    elements: {
        cpu: {
            panel: {},
            menu: {},
            state: new Cpu_State(),
            update: function () {
                let self = this.state ? this : this.elements.cpu;
                self.state.update();
                self.panel.value.set_text(self.state.percent().toString());
                self.menu.value.set_text(self.state.percent().toString());
                self.chart._addValue(self.state.list(), self.panel.box.visible);
                return true;
            }
        },
        memory: {
            panel: {},
            menu: {},
            state: new Mem_State(),
            update: function () {
                let self = this.state ? this : this.elements.memory;
                self.state.update();
                self.panel.value.set_text(self.state.percent().toString());
                self.menu.used.set_text(self.state.mem[0].toString());
                self.menu.total.set_text(self.state.mem_total.toString());
                self.chart._addValue(self.state.mem_list());
                return true;
            }
        },
        swap: {
            panel: {},
            menu: {},
            state: new Swap_State(),
            update: function () {
                let self = this.state ? this : this.elements.swap;
                self.state.update();
                self.panel.value.set_text(self.state.percent().toString());
                self.menu.used.set_text(self.state.swap.toString());
                self.menu.total.set_text(self.state.swap_total.toString());
                self.chart._addValue(self.state.swap_list(), self.panel.box.visible);
                return true;
            }
        },
        net: {
            panel: {},
            menu: {},
            state: new Net_State(),
            update: function () {
                let self = this.state ? this : this.elements.net;
                self.state.update();
                self.panel.down.set_text(self.state.usage[0].toString());
                self.panel.up.set_text(self.state.usage[1].toString());
                self.menu.down.set_text(self.state.usage[0] + " kB/s");
                self.menu.up.set_text(self.state.usage[1] + " kB/s");
                self.chart._addValue(self.state.list(), self.panel.box.visible);
                return true;
            }
        },
        disk: {
            panel: {},
            menu: {},
            state: new Disk_State(),
            update: function () {
                let self = this.state ? this : this.elements.disk;
                self.state.update();
                let percents = self.state.percent();
                self.panel.read.set_text(percents[0].toString());
                self.panel.write.set_text(percents[1].toString());
                self.menu.read.set_text(percents[0] + " %");
                self.menu.write.set_text(percents[1] + " %");
                self.chart._addValue(self.state.list(), self.panel.box.visible);
                return true;
            }
        }
    },
    _init_menu: function() {
        let section = new PopupMenu.PopupMenuSection("Usages");
        this.menu.addMenuItem(section);

        let item = new PopupMenu.PopupMenuItem(_("Cpu"));
        item.addActor(new St.Label({ text:':', style_class: "sm-label"}));
        this.elements.cpu.menu.value = new St.Label({ style_class: "sm-value"});
        item.addActor(new St.Label({ style_class: "sm-void"}));
        item.addActor(new St.Label({ style_class: "sm-void"}));
        item.addActor(this.elements.cpu.menu.value);
        item.addActor(new St.Label({ text:'%', style_class: "sm-label"}));
        item.connect('activate', Open_Window);
        section.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_("Memory"));
        this.elements.memory.menu.used = new St.Label({ style_class: "sm-value"});
        this.elements.memory.menu.total = new St.Label({ style_class: "sm-value"});
        item.addActor(new St.Label({ text:':', style_class: "sm-label"}));
        item.addActor(this.elements.memory.menu.used);
        item.addActor(new St.Label({ text: "/", style_class: "sm-label"}));
        item.addActor(this.elements.memory.menu.total);
        item.addActor(new St.Label({ text: "MB", style_class: "sm-label"}));
        item.connect('activate', Open_Window);
        section.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_("Swap"));
        this.elements.swap.menu.used = new St.Label({ style_class: "sm-value"});
        this.elements.swap.menu.total = new St.Label({ style_class: "sm-value"});
        item.addActor(new St.Label({ text:':', style_class: "sm-label"}));
        item.addActor(this.elements.swap.menu.used);
        item.addActor(new St.Label({ text: "/", style_class: "sm-label"}));
        item.addActor(this.elements.swap.menu.total);
        item.addActor(new St.Label({ text: "MB", style_class: "sm-label"}));
        item.connect('activate', Open_Window);
        section.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_("Net"));
        item.addActor(new St.Label({ text:':', style_class: "sm-label"}));
        this.elements.net.menu.down = new St.Label({ style_class: "sm-value"});
        item.addActor(this.elements.net.menu.down);
        item.addActor(new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: 16, icon_name:'go-down'}));
        this.elements.net.menu.up = new St.Label({ style_class: "sm-value"});
        item.addActor(this.elements.net.menu.up);
        item.addActor(new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: 16, icon_name:'go-up'}));
        item.connect('activate', Open_Window);
        section.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_("Disk"));
        item.addActor(new St.Label({ text:':', style_class: "sm-label"}));
        this.elements.disk.menu.read = new St.Label({ style_class: "sm-value"});
        item.addActor(this.elements.disk.menu.read);
        item.addActor(new St.Label({ text:'R', style_class: "sm-label"}));
        this.elements.disk.menu.write = new St.Label({ style_class: "sm-value"});
        item.addActor(this.elements.disk.menu.write);
        item.addActor(new St.Label({ text:'W', style_class: "sm-label"}));
        item.connect('activate', Open_Window);
        section.addMenuItem(item);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        item = new PopupMenu.PopupMenuItem(_("Preferences..."));
        item.connect('activate', Open_Preference);
        this.menu.addMenuItem(item);

    },
    _init_status: function() {
        let box = new St.BoxLayout();
        this._icon_ = new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: this.icon_size, icon_name:'utilities-system-monitor'});
        this.elements.memory.panel.value = new St.Label({ style_class: "sm-status-value"});
        this.elements.swap.panel.value = new St.Label({ style_class: "sm-status-value"});
        this.elements.cpu.panel.value = new St.Label({ style_class: "sm-status-value"});
        this.elements.net.panel.down = new St.Label({ style_class: "sm-big-status-value"});
        this.elements.net.panel.up = new St.Label({ style_class: "sm-big-status-value"});
        this.elements.disk.panel.read = new St.Label({ style_class: "sm-big-status-value"});
        this.elements.disk.panel.write = new St.Label({ style_class: "sm-big-status-value"});

        let background = this._schema.get_string('background');

        let colors = [];
        colors.push(this._schema.get_string('memory-program-color'));
        colors.push(this._schema.get_string('memory-buffer-color'));
        colors.push(this._schema.get_string('memory-cache-color'));
        this.elements.memory.chart = new Chart(colors, background, this._schema.get_int('memory-graph-width'), this.icon_size);

        let mem_color = function() {
            let colors = [];
            colors.push(this._schema.get_string('memory-program-color'));
            colors.push(this._schema.get_string('memory-buffer-color'));
            colors.push(this._schema.get_string('memory-cache-color'));
            let background = this._schema.get_string('background');
            this.elements.memory.chart._rcolor(colors);
            this.elements.memory.chart._bk_grd(background);
            this.elements.memory.chart.actor.queue_repaint();
            return true;
        };

        this._schema.connect('changed::memory-program-color', Lang.bind(this, mem_color));
        this._schema.connect('changed::memory-buffer-color', Lang.bind(this, mem_color));
        this._schema.connect('changed::memory-cache-color', Lang.bind(this, mem_color));
        this._schema.connect('changed::background', Lang.bind(this, mem_color));

        colors = [];
        colors.push(this._schema.get_string('swap-used-color'));
        this.elements.swap.chart = new Chart(colors, background, this._schema.get_int('swap-graph-width'), this.icon_size);

        let swap_color = function() {
            let colors = [];
            colors.push(this._schema.get_string('swap-used-color'));
            let background = this._schema.get_string('background');
            this.elements.swap.chart._rcolor(colors);
            this.elements.swap.chart._bk_grd(background);
            this.elements.swap.chart.actor.queue_repaint();
            return true;
        };

        this._schema.connect('changed::swap-used-color', Lang.bind(this, swap_color));
        this._schema.connect('changed::background', Lang.bind(this, swap_color));

        colors = [];
        colors.push(this._schema.get_string('net-down-color'));
        colors.push(this._schema.get_string('net-up-color'));
        this.elements.net.chart = new Chart(colors, background, this._schema.get_int('net-graph-width'), this.icon_size);

        let net_color = function() {
            let colors = [];
            colors.push(this._schema.get_string('net-down-color'));
            colors.push(this._schema.get_string('net-up-color'));
            let background = this._schema.get_string('background');
            this.elements.net.chart._rcolor(colors);
            this.elements.net.chart._bk_grd(background);
            this.elements.net.chart.actor.queue_repaint();
            return true;
        };

        this._schema.connect('changed::net-down-color', Lang.bind(this, net_color));
        this._schema.connect('changed::net-up-color', Lang.bind(this, net_color));
        this._schema.connect('changed::background', Lang.bind(this, net_color));


        colors = [];
        colors.push(this._schema.get_string('cpu-user-color'));
        colors.push(this._schema.get_string('cpu-system-color'));
        colors.push(this._schema.get_string('cpu-nice-color'));
        colors.push(this._schema.get_string('cpu-iowait-color'));
        colors.push(this._schema.get_string('cpu-other-color'));
        this.elements.cpu.chart = new Chart(colors, background, this._schema.get_int('cpu-graph-width'), this.icon_size);

        let cpu_color = function() {
            let colors = [];
            colors.push(this._schema.get_string('cpu-user-color'));
            colors.push(this._schema.get_string('cpu-system-color'));
            colors.push(this._schema.get_string('cpu-nice-color'));
            colors.push(this._schema.get_string('cpu-iowait-color'));
            colors.push(this._schema.get_string('cpu-other-color'));
            let background = this._schema.get_string('background');
            this.elements.cpu.chart._rcolor(colors);
            this.elements.cpu.chart._bk_grd(background);
            this.elements.cpu.chart.actor.queue_repaint();
            return true;
        };

        this._schema.connect('changed::cpu-user-color', Lang.bind(this, cpu_color));
        this._schema.connect('changed::cpu-system-color', Lang.bind(this, cpu_color));
        this._schema.connect('changed::cpu-nice-color', Lang.bind(this, cpu_color));
        this._schema.connect('changed::cpu-iowait-color', Lang.bind(this, cpu_color));
        this._schema.connect('changed::cpu-other-color', Lang.bind(this, cpu_color));
        this._schema.connect('changed::background', Lang.bind(this, cpu_color));

        colors = [];
        colors.push(this._schema.get_string('disk-read-color'));
        colors.push(this._schema.get_string('disk-write-color'));
        this.elements.disk.chart = new Chart(colors, background, this._schema.get_int('disk-graph-width'), this.icon_size);

        let disk_color = function() {
            let colors = [];
            colors.push(this._schema.get_string('disk-read-color'));
            colors.push(this._schema.get_string('disk-write-color'));
            let background = this._schema.get_string('background');
            this.elements.disk.chart._rcolor(colors);
            this.elements.disk.chart._bk_grd(background);
            this.elements.disk.chart.actor.queue_repaint();
            return true;
        };

        this._schema.connect('changed::disk-read-color', Lang.bind(this, disk_color));
        this._schema.connect('changed::disk-write-color', Lang.bind(this, disk_color));
        this._schema.connect('changed::background', Lang.bind(this, disk_color));

        box.add_actor(this._icon_);

        let text_disp = function(text, schema) {
            let apply = function() {
                text.visible = this._schema.get_boolean(schema);
            };
            Lang.bind(this, apply)();
            this._schema.connect('changed::' + schema, Lang.bind(this, apply));
        };

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
            };
            Lang.bind(this, apply)();
            this._schema.connect('changed::' + schema, Lang.bind(this, apply));
        };

        let text, digits = [], digit;
        this.elements.cpu.panel.box = new St.BoxLayout();
        text = new St.Label({ text: _('cpu'), style_class: "sm-status-label"});
        Lang.bind(this, text_disp)(text, 'cpu-show-text');
        this.elements.cpu.panel.box.add_actor(text);
        this.elements.cpu.panel.box.add_actor(this.elements.cpu.panel.value);
        digits.push(this.elements.cpu.panel.value);
        digit = new St.Label({ text: '%', style_class: "sm-perc-label"});
        this.elements.cpu.panel.box.add_actor(digit);
        digits.push(digit);
        this.elements.cpu.panel.box.add_actor(this.elements.cpu.chart.actor);
        Lang.bind(this, disp_style)(digits, this.elements.cpu.chart.actor, 'cpu-style');
        box.add_actor(this.elements.cpu.panel.box);

        digits = [];
        this.elements.memory.panel.box = new St.BoxLayout();
        text = new St.Label({ text: _('mem'), style_class: "sm-status-label"});
        Lang.bind(this, text_disp)(text, 'memory-show-text');
        this.elements.memory.panel.box.add_actor(text);
        this.elements.memory.panel.box.add_actor(this.elements.memory.panel.value);
        digits.push(this.elements.memory.panel.value);
        digit = new St.Label({ text: '%', style_class: "sm-perc-label"});
        this.elements.memory.panel.box.add_actor(digit);
        digits.push(digit);
        this.elements.memory.panel.box.add_actor(this.elements.memory.chart.actor);
        Lang.bind(this, disp_style)(digits, this.elements.memory.chart.actor, 'memory-style');
        box.add_actor(this.elements.memory.panel.box);

        digits = [];
        this.elements.swap.panel.box = new St.BoxLayout();
        text = new St.Label({ text: _('swap'), style_class: "sm-status-label"});
        Lang.bind(this, text_disp)(text, 'swap-show-text');
        this.elements.swap.panel.box.add_actor(text);
        this.elements.swap.panel.box.add_actor(this.elements.swap.panel.value);
        digits.push(this.elements.swap.panel.value);
        digit = new St.Label({ text: '%', style_class: "sm-perc-label"});
        this.elements.swap.panel.box.add_actor(digit);
        digits.push(digit);
        this.elements.swap.panel.box.add_actor(this.elements.swap.chart.actor);
        Lang.bind(this, disp_style)(digits, this.elements.swap.chart.actor, 'swap-style');
        box.add_actor(this.elements.swap.panel.box);

        digits = [];
        this.elements.net.panel.box = new St.BoxLayout();
        text = new St.Label({ text: _('net'), style_class: "sm-status-label"});
        Lang.bind(this, text_disp)(text, 'net-show-text');
        this.elements.net.panel.box.add_actor(text);
        digit = new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: 2 * this.icon_size / 3, icon_name:'go-down'});
        this.elements.net.panel.box.add_actor(digit);
        digits.push(digit);
        this.elements.net.panel.box.add_actor(this.elements.net.panel.down);
        digits.push(this.elements.net.panel.down);
        digit = new St.Label({ text: 'kB/s', style_class: "sm-unit-label"});
        this.elements.net.panel.box.add_actor(digit);
        digits.push(digit);
        digit = new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: 2 * this.icon_size / 3, icon_name:'go-up'});
        this.elements.net.panel.box.add_actor(digit);
        digits.push(digit);
        this.elements.net.panel.box.add_actor(this.elements.net.panel.up);
        digits.push(this.elements.net.panel.up);
        digit = new St.Label({ text: 'kB/s', style_class: "sm-unit-label"});
        this.elements.net.panel.box.add_actor(digit);
        digits.push(digit);
        this.elements.net.panel.box.add_actor(this.elements.net.chart.actor);
        Lang.bind(this, disp_style)(digits, this.elements.net.chart.actor, 'net-style');
        box.add_actor(this.elements.net.panel.box);

        digits = [];
        this.elements.disk.panel.box = new St.BoxLayout();
        text = new St.Label({ text: _('disk'), style_class: "sm-status-label"});
        Lang.bind(this, text_disp)(text, 'disk-show-text');
        this.elements.disk.panel.box.add_actor(text);
        digit = new St.Label({ text: 'R', style_class: "sm-status-label"});
        this.elements.disk.panel.box.add_actor(digit);
        digits.push(digit);
        this.elements.disk.panel.box.add_actor(this.elements.disk.panel.read);
        digits.push(this.elements.disk.panel.read);
        digit = new St.Label({ text: '%', style_class: "sm-perc-label"});
        this.elements.disk.panel.box.add_actor(digit);
        digits.push(digit);
        digit = new St.Label({ text: 'W', style_class: "sm-status-label"});
        this.elements.disk.panel.box.add_actor(digit);
        digits.push(digit);
        this.elements.disk.panel.box.add_actor(this.elements.disk.panel.write);
        digits.push(this.elements.disk.panel.write);
        digit = new St.Label({ text: '%', style_class: "sm-perc-label"});
        this.elements.disk.panel.box.add_actor(digit);
        digits.push(digit);
        this.elements.disk.panel.box.add_actor(this.elements.disk.chart.actor);
        Lang.bind(this, disp_style)(digits, this.elements.disk.chart.actor, 'disk-style');
        box.add_actor(this.elements.disk.panel.box);

        this.actor.set_child(box);
    },
    _init: function() {
        Panel.__system_monitor = this;
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'utilities-system-monitor', _('System monitor'));
        this._schema = new Gio.Settings({ schema: 'org.gnome.shell.extensions.system-monitor' });

        this._init_status();
        this._init_menu();

        this._icon_.visible = this._schema.get_boolean("icon-display");
        this._schema.connect(
            'changed::icon-display',
            Lang.bind(this,
                      function () {
                          this._icon_.visible = this._schema.get_boolean("icon-display");
                      }));

        let l_limit = function(a) {
            return (a > 0) ? a : 1000;
        };

        for (let element in this.elements) {
            let elt = element;
            this.elements[elt].panel.box.visible = this._schema.get_boolean(elt + "-display");
            this._schema.connect(
                'changed::' + element + '-display',
                Lang.bind(this,
                          function () {
                              this.elements[elt].panel.box.visible = this._schema.get_boolean(elt + "-display");
                          })
            );
            this.elements[elt].update();
            this.elements[elt].interval = l_limit(this._schema.get_int(elt + "-refresh-time"));
            this.elements[elt].timeout = GLib.timeout_add(0, this.elements[elt].interval, Lang.bind(this, this.elements[elt].update));
            this._schema.connect(
                'changed::' + elt + '-refresh-time',
                Lang.bind(this,
                          function () {
                              GLib.source_remove(this.elements[elt].timeout);
                              this.elements[elt].interval = Math.abs(this._schema.get_int(elt + "-refresh-time"));
                              this.elements[elt].timeout = GLib.timeout_add(0, this.elements[elt].interval, Lang.bind(this, this.elements[elt].update));
                          })
            );
            this._schema.connect(
                'changed::' + elt + '-graph-width',
                Lang.bind(this,
                          function () {
                              this.elements[elt].chart.width = this._schema.get_int(elt + "-graph-width");
                              this.elements[elt].chart.actor.set_width(this.elements[elt].chart.width);
                              this.elements[elt].chart.actor.queue_repaint();
                          })
            );
        }

        if(this._schema.get_boolean("center-display")) {
            Main.panel._centerBox.add(this.actor);
        }

    },

    _onDestroy: function() {}
};


function main() {
    Panel.STANDARD_TRAY_ICON_ORDER.unshift('system-monitor');
    Panel.STANDARD_TRAY_ICON_SHELL_IMPLEMENTATION['system-monitor'] = SystemMonitor;
}
