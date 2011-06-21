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

const Schema = new Gio.Settings({ schema: 'org.gnome.shell.extensions.system-monitor' });
var Background = new Clutter.Color();
Background.from_string(Schema.get_string('background'));

function Chart() {
    this._init.apply(this, arguments);
}

Chart.prototype = {
    _init: function(width, height, parent) {
        this.actor = new St.DrawingArea({ style_class: "sm-chart", reactive: true});
        this.parent = parent;
        this.actor.set_width(this.width=width);
        this.actor.set_height(this.height=height);
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
        let max = Math.max.apply(this, this.data[this.data.length - 1]);
        max = Math.max(1, Math.pow(2, Math.ceil(Math.log(max) / Math.log(2))));
        Clutter.cairo_set_source_color(cr, Background);
        cr.rectangle(0, 0, width, height);
        cr.fill();
        for (let i = this.parent.colors.length - 1;i >= 0;i--) {
            cr.moveTo(width, height);
            for (let j = this.data[i].length - 1;j >= 0;j--) {
                cr.lineTo(width - (this.data[i].length - 1 - j), (1 - this.data[i][j] / max) * height);
            }
            cr.lineTo(width - (this.data[i].length - 1), height);
            cr.closePath();
            Clutter.cairo_set_source_color(cr, this.parent.colors[i]);
            cr.fill();
        }
    }
};

function update_color() {
    this.from_string(Schema.get_string(arguments[1]));
}

function ElementBase() {
    throw new TypeError('Trying to instantiate abstrace class ElementBase');
}

ElementBase.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,
    icon_size: Math.round(Panel.PANEL_ICON_SIZE * 4 / 5),
    color_names: {
        cpu: ['user', 'system', 'nice', 'iowait', 'other'],
        memory: ['program', 'buffer', 'cache'],
        swap: ['used'],
        net: ['down', 'up'],
        disk: ['read', 'write']
    },
    vals: {},
    _init: function(elt) {
        this.elt = elt;
        PanelMenu.SystemStatusButton.prototype._init.call(this, '', '');
        this.colors = [];
        for(let color in this.color_names[elt]) {
            let clutterColor = new Clutter.Color();
            let name = elt + '-' + this.color_names[elt][color] + '-color';
            clutterColor.from_string(Schema.get_string(name));
            Schema.connect('changed::' + name, Lang.bind(clutterColor, update_color));
            Schema.connect('changed::' + name,
                           Lang.bind(this,
                                     function() {
                                         this.chart.actor.queue_repaint();
                                     }));
            this.colors.push(clutterColor);
        }
        this.chart = new Chart(Schema.get_int(elt + '-graph-width'), this.icon_size, this);
        Schema.connect('changed::background',
                       Lang.bind(this,
                                 function() {
                                     this.chart.actor.queue_repaint();
                                 }));

        this.box = new St.BoxLayout();
        this.actor.set_child(this.box);
        this.actor.visible = Schema.get_boolean(elt + "-display");
        Schema.connect(
            'changed::' + elt + '-display',
            Lang.bind(this,
                      function () {
                          this.actor.visible = Schema.get_boolean(this.elt + "-display");
                      })
        );

        let l_limit = function(a) {
            return (a > 0) ? a : 1000;
        };

        this.interval = l_limit(Schema.get_int(elt + "-refresh-time"));
        this.timeout = Mainloop.timeout_add(
            this.interval,
            Lang.bind(this, function () {
                          if(this.actor.visible) {
                              this.update();
                          }
                          return true;
                      })
        );
        Schema.connect(
            'changed::' + elt + '-refresh-time',
            Lang.bind(this,
                      function () {
                          Mainloop.source_remove(this.timeout);
                          this.interval = Math.abs(Schema.get_int(elt + "-refresh-time"));
                          this.timeout = Mainloop.timeout_add(
                              this.interval,
                              Lang.bind(this, function () {
                                            if(this.actor.visible) {
                                                this.update();
                                            }
                                            return true;
                                        })
                          );
                      })
        );
        Schema.connect(
            'changed::' + elt + '-graph-width',
            Lang.bind(this,
                      function () {
                          this.chart.width = Schema.get_int(elt + "-graph-width");
                          this.chart.actor.set_width(this.chart.width);
                          this.chart.actor.queue_repaint();
                      })
        );

        this.label = new St.Label({ text: elt == "memory" ? "mem" : _(elt), style_class: "sm-status-label"});
        let change_text = function() {
            this.label.visible = Schema.get_boolean(elt + '-show-text');
        };
        Lang.bind(this, change_text)();
        Schema.connect('changed::' + elt + '-show-text', Lang.bind(this, change_text));

        this.box.add_actor(this.label);
        this.text_box = new St.BoxLayout();

        this.box.add_actor(this.text_box);
        this.box.add_actor(this.chart.actor);
        let change_style = function() {
            let style = Schema.get_string(elt + '-style');
            this.text_box.visible = style == 'digit' || style == 'both';
            this.chart.actor.visible = style == 'graph' || style == 'both';
        };
        Lang.bind(this, change_style)();
        Schema.connect('changed::' + elt + '-style', Lang.bind(this, change_style));

        // Menu
        for(let col in this.color_names[elt]) {
            let i = col;
            let color = this.color_names[elt][i];
            let item = new PopupMenu.PopupMenuItem(color, {reactive: false});
            this["_" + color + "_bar"] = new St.DrawingArea({ style_class: "sm-chart", reactive: false});
            this["_" + color + "_bar"].set_width(120);
            this["_" + color + "_bar"].set_height(20);
            item.addActor(this["_" + color + "_bar"]);
            this["_" + color] = new St.Label({ style_class: "sm-status-value"});
            item.addActor(this["_" + color]);
            item.addActor(new St.Label({ text: '%', style_class: "sm-label"}));
            this.menu.addMenuItem(item);
            this["_" + color + "_bar"].connect(
                'repaint',
                Lang.bind(this, function () {
                              if(this.vals[color]) {
                                  let cr = this["_" + color + "_bar"].get_context();
                                  Clutter.cairo_set_source_color(cr, this.colors[i]);
                                  cr.rectangle(0, 4, this.vals[color], 12);
                                  cr.fill();
                              }
                          }));
        }
        this.menu.connect(
            'open-state-changed',
            Lang.bind(this,
                      function (menu, isOpen) {
                          if(isOpen) {
                              this.update_menu(this.elt);
                              this.menu_timeout = Mainloop.timeout_add_seconds(
                                  1,
                                  Lang.bind(this, function () {
                                                this.update_menu(this.elt);
                                                return true;
                                            }));
                          } else {
                              Mainloop.source_remove(this.menu_timeout);
                          }
                      })
        );
    },
    update_menu: function (elt) {
        let list = this.list();
        let total = this.total();
        if(total == 0) {
            for(let i in list) {
                total += list[i];
            }
        }
        for(let col in this.color_names[elt]) {
            let color = this.color_names[elt][col];
            let val = total == 0 ? 0 : Math.round((100 * list[col] / total));
            this["_" + color].set_text(val.toString());
            this.vals[color] = val;
            this["_" + color + "_bar"].queue_repaint();
        }
    }
};


function Cpu() {
    this._init.apply(this, arguments);
}
Cpu.prototype = {
    __proto__: ElementBase.prototype,
    _init: function() {
        this.last = [0,0,0,0,0];
        this.last_total = 0;
        this.usage = [0,0,0,1,0];
        ElementBase.prototype._init.call(this, "cpu");
        this.value = new St.Label({ style_class: "sm-status-value"});
        this.text_box.add_actor(this.value);
        this.text_box.add_actor(new St.Label({ text: '%', style_class: "sm-perc-label"}));
        this.update();
    },
    update: function () {
        this.refresh();
        this.value.set_text(this.percent().toString());
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
    this._init.apply(this, arguments);
}

Mem.prototype = {
    __proto__: ElementBase.prototype,
    _init: function() {
        ElementBase.prototype._init.call(this, "memory");
        this.value = new St.Label({ style_class: "sm-status-value"});
        this.text_box.add_actor(this.value);
        this.text_box.add_actor(new St.Label({ text: '%', style_class: "sm-perc-label"}));
        this.update();
    },
    update: function () {
        this.refresh();
        this.value.set_text(this.percent().toString());
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
    this._init.apply(this, arguments);
}

Swap.prototype = {
    __proto__: ElementBase.prototype,
    _init: function() {
        ElementBase.prototype._init.call(this, "swap");
        this.value = new St.Label({ style_class: "sm-status-value"});
        this.text_box.add_actor(this.value);
        this.text_box.add_actor(new St.Label({ text: '%', style_class: "sm-perc-label"}));
        this.update();
    },
    update: function () {
        this.refresh();
        this.value.set_text(this.percent().toString());
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
    this._init.apply(this, arguments);
}

Net.prototype = {
    __proto__: ElementBase.prototype,
    _init: function() {
        this.last = [0,0];
        this.usage = [0,0];
        this.last_time = 0;
        ElementBase.prototype._init.call(this, "net");
        this.text_box.add_actor(new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: 2 * this.icon_size / 3, icon_name:'go-down'}));
        this.down = new St.Label({ style_class: "sm-status-value"});
        this.text_box.add_actor(this.down);
        this.text_box.add_actor(new St.Label({ text: 'kB/s', style_class: "sm-unit-label"}));
        this.text_box.add_actor(new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: 2 * this.icon_size / 3, icon_name:'go-up'}));
        this.up = new St.Label({ style_class: "sm-status-value"});
        this.text_box.add_actor(this.up);
        this.text_box.add_actor(new St.Label({ text: 'kB/s', style_class: "sm-unit-label"}));
        this.update();
    },
    update: function () {
        this.refresh();
        this.down.set_text(this.usage[0].toString());
        this.up.set_text(this.usage[1].toString());
        this.chart.actor.queue_repaint();
    },
    refresh: function() {
        let accum = [0,0];
        let time = 0;
        let net_lines = Shell.get_file_contents_utf8_sync('/proc/net/dev').split("\n");
        for(let i = 3; i < net_lines.length - 1 ; i++) {
            let net_params = net_lines[i].replace(/ +/g, " ").split(" ");
            let ifc = net_params[1];
            if(ifc.indexOf("eth") >= 0 || ifc.indexOf("wlan") >= 0) {
                accum[0] += parseInt(net_params[2]);
                accum[1] += parseInt(net_params[10]);
            }
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
    },
    total: function() {
        return 0;
    }
};
Net.instance = new Net();


function Disk() {
    this._init.apply(this, arguments);
}

Disk.prototype = {
    __proto__: ElementBase.prototype,
    _init: function() {
        this.last = [0,0];
        this.usage = [0,0];
        this.last_time = 0;
        ElementBase.prototype._init.call(this, "disk");
        this.text_box.add_actor(new St.Label({ text: 'R', style_class: "sm-status-label"}));
        this.read = new St.Label({ style_class: "sm-status-value"});
        this.text_box.add_actor(this.read);
        this.text_box.add_actor(new St.Label({ text: '%', style_class: "sm-perc-label"}));
        this.text_box.add_actor(new St.Label({ text: 'W', style_class: "sm-status-label"}));
        this.write = new St.Label({ style_class: "sm-status-value"});
        this.text_box.add_actor(this.write);
        this.text_box.add_actor(new St.Label({ text: '%', style_class: "sm-perc-label"}));
        this.update();
    },
    update: function () {
        this.refresh();
        let percents = this.percent();
        this.read.set_text(percents[0].toString());
        this.write.set_text(percents[1].toString());
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
    },
    total: function() {
        return 0;
    }
};
Disk.instance = new Disk();


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


function Icon() {
    this._init.apply(this, arguments);
}

Icon.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,
    icon_size: Math.round(Panel.PANEL_ICON_SIZE * 4 / 5),
    _init: function() {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'utilities-system-monitor', _('System monitor'));

        this.actor.visible = Schema.get_boolean("icon-display");
        Schema.connect(
            'changed::icon-display',
            Lang.bind(this,
                      function () {
                          this.actor.visible = Schema.get_boolean("icon-display");
                          }));
        let item = new PopupMenu.PopupMenuItem(_("Cpu"), {reactive: false});

        this.cpu = new St.Label({ style_class: "sm-value"});
        item.addActor(new St.Label({ style_class: "sm-void"}));
        item.addActor(new St.Label({ style_class: "sm-void"}));
        item.addActor(new St.Label({ style_class: "sm-void"}));
        item.addActor(this.cpu);
        item.addActor(new St.Label({ style_class: "sm-void"}));
        item.addActor(new St.Label({ text:'%', style_class: "sm-label"}));
        this.menu.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_("Memory"), {reactive: false});
        this.mem_used = new St.Label({ style_class: "sm-value"});
        this.mem_total = new St.Label({ style_class: "sm-value"});

        item.addActor(this.mem_used);
        item.addActor(new St.Label({ style_class: "sm-void"}));
        item.addActor(new St.Label({ text: "/", style_class: "sm-label"}));
        item.addActor(this.mem_total);
        item.addActor(new St.Label({ style_class: "sm-void"}));
        item.addActor(new St.Label({ text: "M", style_class: "sm-label"}));
        this.menu.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_("Swap"), {reactive: false});
        this.swap_used = new St.Label({ style_class: "sm-value"});
        this.swap_total = new St.Label({ style_class: "sm-value"});

        item.addActor(this.swap_used);
        item.addActor(new St.Label({ style_class: "sm-void"}));
        item.addActor(new St.Label({ text: "/", style_class: "sm-label"}));
        item.addActor(this.swap_total);
        item.addActor(new St.Label({ style_class: "sm-void"}));
        item.addActor(new St.Label({ text: "M", style_class: "sm-label"}));
        this.menu.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_("Net"), {reactive: false});

        this.down = new St.Label({ style_class: "sm-value"});
        item.addActor(this.down);
        item.addActor(new St.Label({ text:'k', style_class: "sm-label"}));
        item.addActor(new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: 16, icon_name:'go-down'}));
        this.up = new St.Label({ style_class: "sm-value"});
        item.addActor(this.up);
        item.addActor(new St.Label({ text:'k', style_class: "sm-label"}));
        item.addActor(new St.Icon({ icon_type: St.IconType.SYMBOLIC, icon_size: 16, icon_name:'go-up'}));
        this.menu.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_("Disk"), {reactive: false});

        this.read = new St.Label({ style_class: "sm-value"});
        item.addActor(this.read);
        item.addActor(new St.Label({ text:'%', style_class: "sm-label"}));
        item.addActor(new St.Label({ text:'R', style_class: "sm-label"}));
        this.write = new St.Label({ style_class: "sm-value"});
        item.addActor(this.write);
        item.addActor(new St.Label({ text:'%', style_class: "sm-label"}));
        item.addActor(new St.Label({ text:'W', style_class: "sm-label"}));
        this.menu.addMenuItem(item);

        item = new PopupMenu.PopupBaseMenuItem({reactive: false});
        item.addActor(Pie.instance.actor, {span: -1, expand: true});
        this.menu.addMenuItem(item);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        item = new PopupMenu.PopupMenuItem(_("System Monitor..."));
        item.connect('activate', function () {
                         Util.spawn(["gnome-system-monitor"]);
                     });
        this.menu.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_("Preferences..."));
        item.connect('activate', function () {
                         Util.spawn(["system-monitor-applet-config"]);
                     });
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
        );
    },
    update: function () {
        Cpu.instance.update();
        Mem.instance.update();
        Swap.instance.update();
        Net.instance.update();
        Disk.instance.update();
        this.cpu.set_text(Cpu.instance.percent().toString());
        this.mem_used.set_text(Mem.instance.mem[0].toString());
        this.mem_total.set_text(Mem.instance.mem_total.toString());
        this.swap_used.set_text(Swap.instance.swap.toString());
        this.swap_total.set_text(Swap.instance.swap_total.toString());
        this.down.set_text(Net.instance.usage[0].toString());
        this.up.set_text(Net.instance.usage[1].toString());
        this.read.set_text(Disk.instance.percent()[0].toString());
        this.write.set_text(Disk.instance.percent()[1].toString());
    }
};
Icon.instance = new Icon();


function main() {
    let panel = Main.panel._rightBox;
    if(Schema.get_boolean("center-display")) {
        panel = Main.panel._centerBox;
    }
    Schema.connect('changed::background', Lang.bind(Background, update_color));
    let elts = {
        disk: Disk.instance,
        net: Net.instance,
        swap: Swap.instance,
        memory: Mem.instance,
        cpu: Cpu.instance
    };
    //Debug
    Main.__sm = {};
    for (let elt in elts) {
        panel.insert_actor(elts[elt].actor, 1);
        panel.child_set(elts[elt].actor, { y_fill : true } );
        Main.panel._menus.addMenu(elts[elt].menu);
        elts[elt].actor.remove_style_class_name("panel-button");
        elts[elt].actor.add_style_class_name("sm-panel-button");
        Main.__sm[elt] = elts[elt];
    }
    let icon = Icon.instance;
    panel.insert_actor(icon.actor, 1);
    panel.child_set(icon.actor);
    Main.panel._menus.addMenu(icon.menu);
}
