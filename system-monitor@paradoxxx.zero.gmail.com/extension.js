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
const Shell = imports.gi.Shell;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const Gettext = imports.gettext.domain('system-monitor-applet');
const _ = Gettext.gettext;

function Open_Window() {
    Util.spawn(["gnome-system-monitor"]);
}

function Open_Preference() {
    Util.spawn(["system-monitor-applet-config"]);
}

function Cpu() {
    this._init();
}
Cpu.prototype = {
    _init: function() {
        this.last = [0,0,0,0,0];
        this.last_total = 0;
        this.usage = [0,0,0,1,0];
        this.panel = {};
        this.menu = {};
        this.colors = [];
    },
    update: function () {
        this.refresh();
        this.panel.value.set_text(this.percent().toString());
        if(this.menuOpen) {
            this.menu.value.set_text(this.percent().toString());
        }
        this.chart.actor.queue_repaint();
    },
    refresh: function() {
        let cpu_params = Shell.get_file_contents_utf8_sync('/proc/stat').split("\n")[0].replace(/ +/g, " ").split(" ");
        let accum = [0,0,0,0,0];
        let total_t = 0;
        for (let i = 1;i <= 5;i++) {
            accum[i - 1] = parseInt(cpu_params[i]);
        }
        for (let i = 1;i < cpu_params.length;i++) {
            let tmp = parseInt(cpu_params[i]);
            if (tmp > 0) total_t += tmp;
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
    },
    total: function() {
        return 1;
    }
};
Cpu.instance = new Cpu();

function Mem() {
    this._init();
}

Mem.prototype = {
    _init: function() {
        this.panel = {};
        this.menu = {};
        this.colors = [];
    },
    update: function () {
        this.refresh();
        this.panel.value.set_text(this.percent().toString());
        if(this.menuOpen) {
            this.menu.used.set_text(this.mem[0].toString());
            this.menu.total.set_text(this.mem_total.toString());
        }
        this.chart.actor.queue_repaint();
    },
    refresh: function() {
        this.mem = [0,0,0];
        this.mem_total = 0;
        let mem_free = 0;
        let meminfo_lines = Shell.get_file_contents_utf8_sync('/proc/meminfo').split("\n");
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
    },
    percent: function() {
        if (this.mem_total == 0) {
            return 0;
        } else {
            return Math.round(this.mem[0] / this.mem_total * 100);
        }
    },
    list: function() {
        let mem = [];
        for (let i = 0;i < this.mem.length;i++) {
            mem[i] = this.mem[i] / this.mem_total;
        }
        return mem;
    },
    total: function() {
        return Math.round(this.mem_total / 1024);
    }
};
Mem.instance = new Mem();

function Swap() {
    this._init();
}

Swap.prototype = {
    _init: function() {
        this.panel = {};
        this.menu = {};
        this.colors = [];
    },
    update: function () {
        this.refresh();
        this.panel.value.set_text(this.percent().toString());
        if(this.menuOpen) {
            this.menu.used.set_text(this.swap.toString());
            this.menu.total.set_text(this.swap_total.toString());
        }
        this.chart.actor.queue_repaint();
    },
    refresh: function() {
        this.swap = 0;
        this.swap_total = 0;
        let swap_free = 0;
        let meminfo_lines = Shell.get_file_contents_utf8_sync('/proc/meminfo').split("\n");
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
    },
    percent: function() {
        if (this.swap_total == 0) {
            return 0;
        } else {
            return Math.round(this.swap / this.swap_total * 100);
        }
    },
    list: function() {
        return [this.swap / this.swap_total];
    },
    total: function() {
        return Math.round(this.swap_total / 1024);
    }
};
Swap.instance = new Swap();

function Net() {
    this._init();
}

Net.prototype = {
    _init: function() {
        this.last = [0,0];
        this.usage = [0,0];
        this.last_time = 0;
        this.panel = {};
        this.menu = {};
        this.colors = [];
    },
    update: function () {
        this.refresh();
        this.panel.down.set_text(this.usage[0].toString());
        this.panel.up.set_text(this.usage[1].toString());
        if(this.menuOpen) {
            this.menu.down.set_text(this.usage[0] + " kB/s");
            this.menu.up.set_text(this.usage[1] + " kB/s");
        }
        this.chart.actor.queue_repaint();
    },
    refresh: function() {
        let accum = [0,0];
        let time = 0;
        let net_lines = Shell.get_file_contents_utf8_sync('/proc/net/dev').split("\n");
        for(let i = 3; i < net_lines.length - 1 ; i++) {
            let net_params = net_lines[i].replace(/ +/g, " ").split(" ");
            accum[0] += parseInt(net_params[2]);
            accum[1] += parseInt(net_params[10]);
        }
        time = GLib.get_monotonic_time() / 1000;
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
Net.instance = new Net();

function Disk() {
    this._init();
}

Disk.prototype = {
    _init: function() {
        this.last = [0,0];
        this.usage = [0,0];
        this.last_time = 0;
        this.panel = {};
        this.menu = {};
        this.colors = [];
    },
    update: function () {
        this.refresh();
        let percents = this.percent();
        this.panel.read.set_text(percents[0].toString());
        this.panel.write.set_text(percents[1].toString());
        if(this.menuOpen) {
            this.menu.read.set_text(percents[0] + " %");
            this.menu.write.set_text(percents[1] + " %");
        }
        this.chart.actor.queue_repaint();
    },
    refresh: function() {
        let accum = [0,0];
        let time = 0;
        let disk_lines = Shell.get_file_contents_utf8_sync('/proc/diskstats').split("\n");
        for(let i = 0;i < disk_lines.length - 1;i++) {
            let disk_params = disk_lines[i].replace(/ +/g, " ").replace(/^ /,"").split(" ");
            if (/[0-9]$/.test(disk_params[2])) continue;
            accum[0] += parseInt(disk_params[6]);
            accum[1] += parseInt(disk_params[10]);
        }
        time = GLib.get_monotonic_time() / 1000;
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
Disk.instance = new Disk();

function Chart() {
    this._init.apply(this, arguments);
}

Chart.prototype = {
    _init: function() {
        this.actor = new St.DrawingArea({ style_class: "sm-chart", reactive: true});
        this.width = arguments[0];
        this.height = arguments[1];
        this.parent = arguments[2];
        this.actor.set_width(this.width);
        this.actor.set_height(this.height);
        this.actor.connect('repaint', Lang.bind(this, this._draw));
        this.data = [];
        for (let i = 0;i < this.parent.colors.length;i++) {
            this.data[i] = [];
        }
    },
    _draw: function() {
        if (!this.actor.visible) return;
        let data_a = this.parent.list();
        if (data_a.length != this.parent.colors.length) return;
        let accdata = [];
        for (let l = 0 ; l < data_a.length ; l++) {
            accdata[l] = (l == 0) ? data_a[0] : accdata[l - 1] + ((data_a[l] > 0) ? data_a[l] : 0);
            this.data[l].push(accdata[l]);
            if (this.data[l].length > this.width)
                this.data[l].shift();
        }

        let [width, height] = this.actor.get_surface_size();
        let cr = this.actor.get_context();
        let max = Math.max.apply(this,this.data[this.data.length - 1]);
        max = Math.max(1, Math.pow(2, Math.ceil(Math.log(max) / Math.log(2))));
        Clutter.cairo_set_source_color(cr, this.parent.background);
        cr.rectangle(0, 0, width, height);
        cr.fill();
        for (let i = this.parent.colors.length - 1 ; i >= 0 ; i--) {
            cr.moveTo(width, height);
            for (let j = this.data[i].length - 1 ; j >= 0 ; j--) {
                cr.lineTo(width - (this.data[i].length - 1 - j), (1 - this.data[i][j] / max) * height);
            }
            cr.lineTo(width - (this.data[i].length - 1), height);
            cr.closePath();
            Clutter.cairo_set_source_color(cr, this.parent.colors[i]);
            cr.fill();
        }
    }
};

function Pie() {
    this._init.apply(this, arguments);
}

Pie.prototype = {
    _init: function() {
        this.actor = new St.DrawingArea({ style_class: "sm-chart", reactive: false});
        this.width = arguments[0];
        this.height = arguments[1];
        this.actor.set_width(this.width);
        this.actor.set_height(this.height);
        this.actor.connect('repaint', Lang.bind(this, this._draw));
    },
    _draw: function() {
        if (!this.actor.visible) return;
        let [width, height] = this.actor.get_surface_size();
        let cr = this.actor.get_context();
        Panel.cr = cr;
        let back_color = new Clutter.Color();
        let xc = width/2;
        let yc = height/2;
        let r = Math.min(xc, yc) - 10;
        let pi = Math.PI;
        function arc(r, value, max, angle) {
            if(max == 0) return angle;
            let new_angle = angle + (value * 2 * pi / max);
            cr.arc(xc, yc, r, angle, new_angle);
            return new_angle;
        }
        cr.setLineWidth(10);
        let things = [Cpu, Mem, Swap];
        for (let thing in things) {
            r -= 15;
            let elt = things[thing].instance;
            let angle = -pi / 2;
            for (let i = 0 ; i < elt.colors.length ; i++) {
                Clutter.cairo_set_source_color(cr, elt.colors[i]);
                // Abs is for float errors
                angle = arc(r, Math.abs(elt.list()[i]), elt.total(), angle);
                cr.stroke();
            }
        }
    }
};
Pie.instance = new Pie(200, 200);

function SystemMonitor() {
    this._init.apply(this, arguments);
}

SystemMonitor.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,
    icon_size: Math.round(Panel.PANEL_ICON_SIZE * 4 / 5),
    elements: {
        cpu: Cpu.instance,
        memory: Mem.instance,
        swap: Swap.instance,
        net: Net.instance,
        disk: Disk.instance
    },
    colors: {
        cpu: ['user', 'system', 'nice', 'iowait', 'other'],
        memory: ['program', 'buffer', 'cache'],
        swap: ['used'],
        net: ['down', 'up'],
        disk: ['read', 'write']
    },
    _init_menu: function() {
        let section = new PopupMenu.PopupMenuSection("Usages");
        this.menu.addMenuItem(section);

        let item = new PopupMenu.PopupBaseMenuItem();
        item.addActor(Pie.instance.actor, {span: -1, expand: true});
        this.menu.addMenuItem(item);


        item = new PopupMenu.PopupMenuItem(_("Cpu"), {reactive: false});
        item.addActor(new St.Label({ text:':', style_class: "sm-label"}));
        this.elements.cpu.menu.value = new St.Label({ style_class: "sm-value"});
        item.addActor(new St.Label({ style_class: "sm-void"}));
        item.addActor(new St.Label({ style_class: "sm-void"}));
        item.addActor(this.elements.cpu.menu.value);
        item.addActor(new St.Label({ text:'%', style_class: "sm-label"}));
        item.connect('activate', Open_Window);
        section.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_("Memory"), {reactive: false});
        this.elements.memory.menu.used = new St.Label({ style_class: "sm-value"});
        this.elements.memory.menu.total = new St.Label({ style_class: "sm-value"});
        item.addActor(new St.Label({ text:':', style_class: "sm-label"}));
        item.addActor(this.elements.memory.menu.used);
        item.addActor(new St.Label({ text: "/", style_class: "sm-label"}));
        item.addActor(this.elements.memory.menu.total);
        item.addActor(new St.Label({ text: "MB", style_class: "sm-label"}));
        item.connect('activate', Open_Window);
        section.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_("Swap"), {reactive: false});
        this.elements.swap.menu.used = new St.Label({ style_class: "sm-value"});
        this.elements.swap.menu.total = new St.Label({ style_class: "sm-value"});
        item.addActor(new St.Label({ text:':', style_class: "sm-label"}));
        item.addActor(this.elements.swap.menu.used);
        item.addActor(new St.Label({ text: "/", style_class: "sm-label"}));
        item.addActor(this.elements.swap.menu.total);
        item.addActor(new St.Label({ text: "MB", style_class: "sm-label"}));
        item.connect('activate', Open_Window);
        section.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_("Net"), {reactive: false});
        item.addActor(new St.Label({ text:':', style_class: "sm-label"}));
        this.elements.net.menu.down = new St.Label({ style_class: "sm-value"});
        item.addActor(this.elements.net.menu.down);
        item.addActor(new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: 16, icon_name:'go-down'}));
        this.elements.net.menu.up = new St.Label({ style_class: "sm-value"});
        item.addActor(this.elements.net.menu.up);
        item.addActor(new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: 16, icon_name:'go-up'}));
        item.connect('activate', Open_Window);
        section.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_("Disk"), {reactive: false});
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

        item = new PopupMenu.PopupMenuItem(_("System Monitor..."));
        item.connect('activate', Open_Window);
        this.menu.addMenuItem(item);

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

        for (let element in this.elements) {
            let elt = element;

            this.elements[elt].background = new Clutter.Color();
            this.elements[elt].background.from_string(this._schema.get_string('background'));
            for(let color in this.colors[elt]) {
                let clutterColor = new Clutter.Color();
                clutterColor.from_string(this._schema.get_string(elt + '-' + this.colors[elt][color] + '-color'));
                this.elements[elt].colors.push(clutterColor);
            }

            let elt_color = function() {
                this.elements[elt].colors = [];
                this.elements[elt].background = new Clutter.Color();
                this.elements[elt].background.from_string(this._schema.get_string('background'));
                for(let color in this.colors[elt]) {
                    let clutterColor = new Clutter.Color();
                    clutterColor.from_string(this._schema.get_string(elt + '-' + this.colors[elt][color] + '-color'));
                    this.elements[elt].colors.push(clutterColor);
                }
                this.elements[elt].chart.actor.queue_repaint();
                return true;
            };
            this.elements[elt].chart = new Chart(this._schema.get_int(elt + '-graph-width'), this.icon_size, this.elements[elt]);
            this._schema.connect('changed::background', Lang.bind(this, elt_color));
            for(let col in this.colors[elt]) {
                this._schema.connect('changed::' + elt + '-' + this.colors[elt][col] + '-color', Lang.bind(this, elt_color));
            }
        }

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
            this.elements[elt].timeout = Mainloop.timeout_add(
                this.elements[elt].interval,
                Lang.bind(this, function () {
                              if(this.elements[elt].panel.box.visible) {
                                  this.elements[elt].update();
                              }
                              return true;
                          })
            );
            this._schema.connect(
                'changed::' + elt + '-refresh-time',
                Lang.bind(this,
                          function () {
                              Mainloop.source_remove(this.elements[elt].timeout);
                              this.elements[elt].interval = Math.abs(this._schema.get_int(elt + "-refresh-time"));
                              this.elements[elt].timeout = Mainloop.timeout_add(
                                  this.elements[elt].interval,
                                  Lang.bind(this, function () {
                                                if(this.elements[elt].panel.box.visible) {
                                                    this.elements[elt].update();
                                                }
                                                return true;
                                            })
                              );
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
        this.menu.connect('open-state-changed',
                          Lang.bind(this,
                                    function (menu, isOpen) {
                                        for (let elt in this.elements) {
                                            this.elements[elt].menuOpen = isOpen;
                                        }
                                        if(isOpen) {
                                            for (let elt in this.elements) {
                                                this.elements[elt].update();
                                            }
                                        }
                                    }));
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
