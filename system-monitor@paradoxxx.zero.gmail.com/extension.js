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

let start = GLib.get_monotonic_time();
global.log('system-monitor-applet: start @ ' + start);

const Schema = new Gio.Settings({ schema: 'org.gnome.shell.extensions.system-monitor' });
var Background = new Clutter.Color();
Background.from_string(Schema.get_string('background'));
var icon_size = Math.round(Panel.PANEL_ICON_SIZE * 4 / 5);

function Chart() {
    this._init.apply(this, arguments);
}

Chart.prototype = {
    _init: function(width, height, parent) {
        this.actor = new St.DrawingArea({ style_class: "sm-chart", reactive: false});
        this.parent = parent;
        this.actor.set_width(this.width=width);
        this.actor.set_height(this.height=height);
        this.actor.connect('repaint', Lang.bind(this, this._draw));
        this.data = [];
        for (let i = 0;i < this.parent.colors.length;i++)
            this.data[i] = [];
    },
    update: function() {
        let data_a = this.parent.vals;
        if (data_a.length != this.parent.colors.length) return;
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
        let [width, height] = this.actor.get_surface_size();
        let cr = this.actor.get_context();
        let max = Math.max.apply(this, this.data[this.data.length - 1]);
        max = Math.max(1, Math.pow(2, Math.ceil(Math.log(max) / Math.log(2))));
        Clutter.cairo_set_source_color(cr, Background);
        cr.rectangle(0, 0, width, height);
        cr.fill();
        for (let i = this.parent.colors.length - 1;i >= 0;i--) {
            cr.moveTo(width, height);
            for (let j = this.data[i].length - 1;j >= 0;j--)
                cr.lineTo(width - (this.data[i].length - 1 - j), (1 - this.data[i][j] / max) * height);
            cr.lineTo(width - (this.data[i].length - 1), height);
            cr.closePath();
            Clutter.cairo_set_source_color(cr, this.parent.colors[i]);
            cr.fill();
        }
    },
    resize: function(schema, key) {
        let old_width = this.width;
        this.width = Schema.get_int(key);
        if (old_width == this.width) return;
        this.actor.set_width(this.width);
        if (this.width < this.data[0].length)
            for (let i = 0;i < this.parent.colors.length;i++)
                this.data[i] = this.data[i].slice(-this.width);
    }
};

function update_color(schema, key) {
    this.from_string(Schema.get_string(key));
}
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

function TipBox() {
    this._init.apply(this, arguments);
}

TipBox.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout({ reactive: true });
        this.actor._delegate = this;
        this.tipbox = new St.BoxLayout({ style_class: 'sm-tooltip-box',
                                         vertical: true });
        Main.chrome.addActor(this.tipbox, { visibleInOverview: true,
                                            affectsStruts: false });
        this.tipbox.hide();
        this.in_to = this.out_to = 0;
        this.actor.connect('enter-event', Lang.bind(this, this.on_enter));
        this.actor.connect('leave-event', Lang.bind(this, this.on_leave));
    },
    show_tip: function() {
        this.shift_tip();
        this.layout_tip();
        this.tipbox.show();
        this.tipbox.raise_top();
        if (this.in_to) {
            Mainloop.source_remove(this.in_to);
            this.in_to = 0;
        }
    },
    hide_tip: function() {
        this.tipbox.hide();
        if (this.out_to) {
            Mainloop.source_remove(this.out_to);
            this.out_to = 0;
        }
        if (this.in_to) {
            Mainloop.source_remove(this.in_to);
            this.in_to = 0;
        }
    },
    layout_tip: function() {},
    shift_tip: function() {
        let node = this.actor.get_theme_node();
        let contentbox = node.get_content_box(this.actor.get_allocation_box());
        let allocation = Shell.util_get_transformed_allocation(this.actor);

        // probably need to change for 3.1/3.2
        let primary = global.get_primary_monitor();
        let [x, y] = [allocation.x1 + contentbox.x1,
                      allocation.y1 + contentbox.y1];
        let [cx, cy] = [allocation.x1 + (contentbox.x1 + contentbox.x2) / 2,
                        allocation.y1 + (contentbox.y1 + contentbox.y2) / 2];
        let [xm, ym] = [allocation.x1 + contentbox.x2,
                        allocation.y1 + contentbox.y2];
        let [width, height] = this.actor.get_size();
        let tipx = Math.floor(Math.min(cx - width / 2,
                                       primary.x + primary.width - width));
        let tipy = Math.floor(ym);
        this.tipbox.set_position(tipx, tipy);
    },
    on_enter: function() {
        if (this.out_to) {
            Mainloop.source_remove(this.out_to);
            this.out_to = 0;
        }
        if (!this.in_to)
            this.in_to = Mainloop.timeout_add(500, Lang.bind(this,
                                                        this.show_tip));
    },
    on_leave: function() {
        if (this.in_to) {
            Mainloop.source_remove(this.in_to);
            this.in_to = 0;
        }
        if (!this.out_to)
            this.out_to = Mainloop.timeout_add(500, Lang.bind(this,
                                                              this.hide_tip));
    }
}

function ElementBase() {
    throw new TypeError('Trying to instantiate abstrace class ElementBase');
}

ElementBase.prototype = {
    __proto__: TipBox.prototype,

    elt: '',
    color_name: [],
    text_items: [],
    menu_items: [],
    _init: function() {
        TipBox.prototype._init.apply(this, arguments);

        this.vals = [];
        this.tip_names = [];
        this.tip_labels = [];
        this.tip_units = [];
        this.tip_vals = [];

        this.colors = [];
        for(let color in this.color_name) {
            let clutterColor = new Clutter.Color();
            let name = this.elt + '-' + this.color_name[color] + '-color';
            clutterColor.from_string(Schema.get_string(name));
            Schema.connect('changed::' + name, Lang.bind(clutterColor, update_color));
            Schema.connect('changed::' + name,
                           Lang.bind(this,
                                     function() {
                                         this.chart.actor.queue_repaint();
                                     }));
            this.colors.push(clutterColor);
        }

        this.chart = new Chart(Schema.get_int(this.elt + '-graph-width'), icon_size, this);
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
                          this.timeout = Mainloop.timeout_add(this.interval,
                                                              Lang.bind(this, this.update));
                      }));
        Schema.connect('changed::' + this.elt + '-graph-width',
                       Lang.bind(this.chart, this.chart.resize));

        this.label = new St.Label({ text: this.elt == "memory" ? "mem" : _(this.elt),
                                    style_class: "sm-status-label"});
        change_text.call(this);
        Schema.connect('changed::' + this.elt + '-show-text', Lang.bind(this, change_text));

        this.actor.add_actor(this.label);
        this.text_box = new St.BoxLayout();

        this.actor.add_actor(this.text_box);
        for (let item in this.text_items)
            this.text_box.add_actor(this.text_items[item]);
        this.actor.add_actor(this.chart.actor);
        change_style.call(this);
        Schema.connect('changed::' + this.elt + '-style', Lang.bind(this, change_style));
        for (let item in this.menu_items)
            this.menu_item.addActor(this.menu_items[item]);
    },
    tip_format: function(unit) {
        typeof(unit) == 'undefined' && (unit = '%');
        for (let i = 0;i < this.color_name.length;i++) {
            let tipline = new St.BoxLayout();
            this.tipbox.add_actor(tipline);
            this.tip_names[i] = new St.Label({ text: _(this.color_name[i]) });
            tipline.add_actor(this.tip_names[i]);
            this.tip_labels[i] = new St.Label();
            tipline.add_actor(this.tip_labels[i]);
            this.tip_units[i] = new St.Label({ text: unit });
            tipline.add_actor(this.tip_units[i]);
            this.tip_vals[i] = 0;
        }
    },
    layout_tip: function() {
        let columns = [this.tip_names, this.tip_labels, this.tip_units];
        for (let i in columns) {
            let widths = [];
            for (let j in columns[i])
                widths.push(columns[i][j].get_preferred_width(-1)[1]);
            let width = Math.max.apply(Math, widths);
            for (let j in columns[i])
                columns[i][j].set_width(width);
        }
    },
    update: function() {
        this.refresh();
        this._apply();
        this.chart.update();
        for (let i = 0;i < this.tip_vals.length;i++)
            this.tip_labels[i].text = this.tip_vals[i].toString();
        return true;
    },
};


function Cpu() {
    this._init.apply(this, arguments);
}
Cpu.prototype = {
    __proto__: ElementBase.prototype,
    elt: 'cpu',
    color_name: ['user', 'system', 'nice', 'iowait', 'other'],
    text_items: [new St.Label({ style_class: "sm-status-value"}),
                 new St.Label({ text: '%', style_class: "sm-perc-label"})],
    menu_items: [new St.Label({ style_class: "sm-void"}),
                 new St.Label({ style_class: "sm-void"}),
                 new St.Label({ style_class: "sm-void"}),
                 new St.Label({ style_class: "sm-value"}),
                 new St.Label({ style_class: "sm-void"}),
                 new St.Label({ text: '%', style_class: "sm-label"})],
    _init: function() {
        this.last = [0,0,0,0,0];
        this.last_total = 0;
        this.usage = [0,0,0,1,0];
        this.menu_item = new PopupMenu.PopupMenuItem(_("Cpu"), {reactive: false});
        ElementBase.prototype._init.call(this);
        this.tip_format();
        this.update();
    },
    refresh: function() {
        let cpu_params = Shell.get_file_contents_utf8_sync('/proc/stat').split("\n")[0].replace(/ +/g, " ").split(" ");
        let accum = [];
        let total_t = 0;
        for (let i = 1;i <= 5;i++)
            accum[i - 1] = parseInt(cpu_params[i]);
        for (let i = 1;i < cpu_params.length;i++) {
            let tmp = parseInt(cpu_params[i]);
            tmp > 0 && (total_t += tmp);
        }
        let total = total_t - this.last_total;
        if (total > 0) {
            for (let i = 0;i < 5;i++)
                this.usage[i] = (accum[i] - this.last[i]) / total;
            for (let i = 0;i < 5;i++)
                this.last[i] = accum[i];
            this.last_total = total_t;
        }
    },
    _apply: function() {
        let percent = Math.round((1 - this.usage[3]) * 100);
        this.text_items[0].text = this.menu_items[3].text = percent.toString();
        let other = 1;
        for (let i = 0;i < this.usage.length;i++)
            other -= this.usage[i];
        this.vals = [this.usage[0], this.usage[1], this.usage[2], this.usage[4], other];
        for (let i = 0;i < 5;i++)
            this.tip_vals[i] = Math.round(this.vals[i] * 100);
    }
};


function Mem() {
    this._init.apply(this, arguments);
}

Mem.prototype = {
    __proto__: ElementBase.prototype,
    elt: 'memory',
    color_name: ['program', 'buffer', 'cache'],
    text_items: [new St.Label({ style_class: "sm-status-value"}),
                 new St.Label({ text: '%', style_class: "sm-perc-label"})],
    menu_items: [new St.Label({ style_class: "sm-value"}),
                 new St.Label({ style_class: "sm-void"}),
                 new St.Label({ text: "/", style_class: "sm-label"}),
                 new St.Label({ style_class: "sm-value"}),
                 new St.Label({ style_class: "sm-void"}),
                 new St.Label({ text: "M", style_class: "sm-label"})],
    _init: function() {
        this.menu_item = new PopupMenu.PopupMenuItem(_("Memory"), {reactive: false});
        ElementBase.prototype._init.call(this);
        this.tip_format();
        this.update();
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
    _apply: function() {
        if (this.mem_total == 0) {
            this.vals = this.tip_vals = [0,0,0];
        } else {
            for (let i = 0;i < 3;i++) {
                this.vals[i] = this.mem[i] / this.mem_total;
                this.tip_vals[i] = Math.round(this.vals[i] * 100);
            }
        }
        this.text_items[0].text = this.tip_vals[0].toString();
        this.menu_items[0].text = this.mem[0].toString();
        this.menu_items[3].text = this.mem_total.toString();
    }
};


function Swap() {
    this._init.apply(this, arguments);
}

Swap.prototype = {
    __proto__: ElementBase.prototype,
    elt: 'swap',
    color_name: ['used'],
    text_items: [new St.Label({ style_class: "sm-status-value"}),
                 new St.Label({ text: '%', style_class: "sm-perc-label"})],
    menu_items: [new St.Label({ style_class: "sm-value"}),
                 new St.Label({ style_class: "sm-void"}),
                 new St.Label({ text: "/", style_class: "sm-label"}),
                 new St.Label({ style_class: "sm-value"}),
                 new St.Label({ style_class: "sm-void"}),
                 new St.Label({ text: "M", style_class: "sm-label"})],
    _init: function() {
        this.menu_item = new PopupMenu.PopupMenuItem(_("Swap"), {reactive: false});
        ElementBase.prototype._init.call(this);
        this.tip_format();
        this.update();
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
    _apply: function() {
        if (this.swap_total == 0) {
            this.vals = this.tip_vals = [0];
        } else {
            this.vals[0] = this.swap / this.swap_total;
            this.tip_vals[0] = Math.round(this.vals[0] * 100);
        }
        this.text_items[0].text = this.tip_vals[0].toString();
        this.menu_items[0].text = this.swap.toString();
        this.menu_items[3].text = this.swap_total.toString();
    }
};


function Net() {
    this._init.apply(this, arguments);
}

Net.prototype = {
    __proto__: ElementBase.prototype,
    elt: 'net',
    color_name: ['down', 'up'],
    text_items: [new St.Icon({ icon_type: St.IconType.SYMBOLIC,
                               icon_size: 2 * icon_size / 3,
                               icon_name:'go-down'}),
                 new St.Label({ style_class: "sm-status-value"}),
                 new St.Label({ text: 'kB/s', style_class: "sm-unit-label"}),
                 new St.Icon({ icon_type: St.IconType.SYMBOLIC,
                               icon_size: 2 * icon_size / 3,
                               icon_name:'go-up'}),
                 new St.Label({ style_class: "sm-status-value"}),
                 new St.Label({ text: 'kB/s', style_class: "sm-unit-label"})],
    menu_items: [new St.Label({ style_class: "sm-value"}),
                 new St.Label({ text:'k', style_class: "sm-label"}),
                 new St.Icon({ icon_type: St.IconType.SYMBOLIC,
                               icon_size: 16, icon_name:'go-down'}),
                 new St.Label({ style_class: "sm-value"}),
                 new St.Label({ text:'k', style_class: "sm-label"}),
                 new St.Icon({ icon_type: St.IconType.SYMBOLIC,
                               icon_size: 16, icon_name:'go-up'})],
    _init: function() {
        this.last = [0,0];
        this.usage = [0,0];
        this.last_time = 0;
        this.menu_item = new PopupMenu.PopupMenuItem(_("Net"), {reactive: false});
        ElementBase.prototype._init.call(this);
        this.tip_format('kB/s');
        this.update();
    },
    refresh: function() {
        let accum = [0,0];
        let time = 0;
        let net_lines = Shell.get_file_contents_utf8_sync('/proc/net/dev').split("\n");
        for(let i = 3; i < net_lines.length - 1 ; i++) {
            let net_params = net_lines[i].replace(/ +/g, " ").split(" ");
            let ifc = net_params[1];
            if(ifc.indexOf("br") < 0 && ifc.indexOf("lo") < 0) {
                accum[0] += parseInt(net_params[2]);
                accum[1] += parseInt(net_params[10]);
            }
        }
        time = GLib.get_monotonic_time() / 1000;
        let delta = time - this.last_time;
        if (delta > 0)
            for (let i = 0;i < 2;i++) {
                this.usage[i] = Math.round((accum[i] - this.last[i]) / delta);
                this.last[i] = accum[i];
            }
        this.last_time = time;
    },
    _apply: function() {
        this.tip_vals = this.vals = this.usage;
        this.menu_items[0].text = this.text_items[1].text = this.tip_vals[0].toString();
        this.menu_items[3].text = this.text_items[4].text = this.tip_vals[1].toString();
    }
};


function Disk() {
    this._init.apply(this, arguments);
}

Disk.prototype = {
    __proto__: ElementBase.prototype,
    elt: 'disk',
    color_name: ['read', 'write'],
    text_items: [new St.Label({ text: 'R', style_class: "sm-status-label"}),
                 new St.Label({ style_class: "sm-status-value"}),
                 new St.Label({ text: '%', style_class: "sm-perc-label"}),
                 new St.Label({ text: 'W', style_class: "sm-status-label"}),
                 new St.Label({ style_class: "sm-status-value"}),
                 new St.Label({ text: '%', style_class: "sm-perc-label"})],
    menu_items: [new St.Label({ style_class: "sm-value"}),
                 new St.Label({ text:'%', style_class: "sm-label"}),
                 new St.Label({ text:'R', style_class: "sm-label"}),
                 new St.Label({ style_class: "sm-value"}),
                 new St.Label({ text:'%', style_class: "sm-label"}),
                 new St.Label({ text:'W', style_class: "sm-label"})],
    _init: function() {
        this.last = [0,0];
        this.usage = [0,0];
        this.last_time = 0;
        this.menu_item = new PopupMenu.PopupMenuItem(_("Disk"), {reactive: false});
        ElementBase.prototype._init.call(this);
        this.tip_format();
        this.update();
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
        if (delta > 0)
            for (let i = 0;i < 2;i++) {
                this.usage[i] = (accum[i] - this.last[i]) / delta;
                this.last[i] = accum[i];
            }
        this.last_time = time;
    },
    _apply: function() {
        this.vals = this.usage;
        this.tip_vals = [Math.round(this.usage[0] * 100), Math.round(this.usage[1] * 100)];
        this.menu_items[0].text = this.text_items[1].text = this.tip_vals[0].toString();
        this.menu_items[3].text = this.text_items[4].text = this.tip_vals[1].toString();
    }
};


/*function Pie() {
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
Pie.instance = new Pie(200, 200);*/


function Icon() {
    this._init.apply(this, arguments);
}

Icon.prototype = {
    _init: function() {
        this.actor = new St.Icon({ icon_name: 'utilities-system-monitor',
                                   icon_type: St.IconType.SYMBOLIC,
                                   style_class: 'system-status-icon',
                                   has_tooltip: true,
                                   tooltip_text: _('System monitor')});
        this.actor.visible = Schema.get_boolean("icon-display");
        Schema.connect(
            'changed::icon-display',
            Lang.bind(this,
                      function () {
                          this.actor.visible = Schema.get_boolean("icon-display");
                      }));
    }
};


function main() {
    let panel = Main.panel._rightBox;
    if (Schema.get_boolean("center-display")) {
        let dateMenu = Main.panel._dateMenu;
        Main.panel._centerBox.remove_actor(dateMenu.actor);
        Main.panel._rightBox.insert_actor(dateMenu.actor, 0);
        panel = Main.panel._centerBox;
    }
    Schema.connect('changed::background', Lang.bind(Background, update_color));
    //Debug
    Main.__sm = {
        tray: new PanelMenu.Button(0.5),
        icon: new Icon(),
        elts: {
            cpu: new Cpu(),
            memory: new Mem(),
            swap: new Swap(),
            net: new Net(),
            disk: new Disk()
        }
    };
    let tray = Main.__sm.tray;
    tray.actor.remove_style_class_name('panel-button');
    tray.actor.add_style_class_name('sm-panel-button');
    panel.insert_actor(tray.actor, 1);
    panel.child_set(tray.actor, { y_fill : true } );
    let box = new St.BoxLayout();
    tray.actor.add_actor(box);
    box.add_actor(Main.__sm.icon.actor);
    for (let elt in Main.__sm.elts) {
        box.add_actor(Main.__sm.elts[elt].actor);
        tray.menu.addMenuItem(Main.__sm.elts[elt].menu_item);
    }
    tray.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    let item = new PopupMenu.PopupMenuItem(_("System Monitor..."));
    item.connect('activate', function () {
        Util.spawn(["gnome-system-monitor"]);
    });
    tray.menu.addMenuItem(item);

    item = new PopupMenu.PopupMenuItem(_("Preferences..."));
    item.connect('activate', function () {
        Util.spawn(["system-monitor-applet-config"]);
    });
    tray.menu.addMenuItem(item);

    Main.panel._menus.addMenu(tray.menu);
    let finish = GLib.get_monotonic_time();
    global.log('system-monitor-applet: finish @ ' + finish);
    global.log('system-monitor-applet: use ' + (finish - start));
    log('system-monitor-applet: use ' + (finish - start));
}

/*item = new PopupMenu.PopupBaseMenuItem({reactive: false});
item.addActor(Pie.instance.actor, {span: -1, expand: true});
this.menu.addMenuItem(item);
this.menu.connect(
    'open-state-changed',
    Lang.bind(this,
              function (menu, isOpen) {
                  if(isOpen) {
                      this.update();
                      Pie.instance.actor.queue_repaint();
                      this.menu_timeout = Mainloop.timeout_add_seconds(
                          1,
                          Lang.bind(this, function () {
                              this.update();
                              Pie.instance.actor.queue_repaint();
                              return true;
                          }));
                  } else {
                      Mainloop.source_remove(this.menu_timeout);
                  }
              })
);*/
