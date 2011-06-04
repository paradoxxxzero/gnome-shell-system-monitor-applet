#!/usr/bin/env python
# -*- Mode: Python; py-indent-offset: 4 -*-
# vim: tabstop=4 shiftwidth=4 expandtab

# system-monitor: Gnome shell extension displaying system informations in gnome shell status bar, such as memory usage, cpu usage, network rates…
# Copyright (C) 2011 Florian Mounier aka paradoxxxzero

# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

# Author: Florian Mounier aka paradoxxxzero

from gi.repository import Gtk, Gio, Gdk

colors = {
    'background': 'Background:',
    "memory-user-color": 'Memory (user):',
    "memory-buffer-color": 'Memory (buffer):',
    "memory-cache-color": 'Memory (cache):',
    "net-up-color": 'Network (upload):',
    "net-down-color": 'Network (download):',
    "cpu-user-color": 'Cpu (user):',
    "cpu-system-color": 'Cpu (system):',
    "cpu-nice-color": 'Cpu (nice):',
    "cpu-iowait-color": 'Cpu (iowait):',
    "cpu-other-color": 'Cpu (other):',
    "swap-used-color": 'Swap:',
    "disk-read-color": 'Disk read:',
    "disk-write-color": 'Disk write:',
    }

def color_to_hex(color):
    return "#%02x%02x%02x%02x" % (
        color.red * 255,
        color.green * 255,
        color.blue * 255,
        color.alpha * 255)

def hex_to_color(hexstr):
    return Gdk.RGBA(
        int(hexstr[1:3], 16) / 255,
        int(hexstr[3:5], 16) / 255,
        int(hexstr[5:7], 16) / 255,
        int(hexstr[7:9], 16) / 255 if len(hexstr) == 9 else 1)


class App:
    opt = {}

    def __init__(self):
        self.schema = Gio.Settings('org.gnome.shell.extensions.system-monitor')
        for color in colors:
            self.opt[color] = self.schema.get_string(color)
            self.opt[color] = self.schema.get_string(color)
            self.opt[color] = self.schema.get_string(color)
            self.opt[color] = self.schema.get_string(color)
            self.opt[color] = self.schema.get_string(color)
            self.opt[color] = self.schema.get_string(color)
            self.opt[color] = self.schema.get_string(color)
        self.window = Gtk.Window(title='System Monitor Applet Configurator')
        self.window.connect('destroy', Gtk.main_quit)
        self.window.set_border_width(10)

        table = Gtk.Table(len(colors), 2, False)
        table.set_col_spacing(0, 10)
        table.set_row_spacings(3)
        self.window.add(table)
        table.set_border_width(10)
        i = 0
        for key, title in sorted(colors.items()):
            label = Gtk.Label(title)
            label.set_alignment(0.0, 0.5)
            picker = Gtk.ColorButton()
            picker.set_rgba(hex_to_color(self.opt[key]))
            picker.set_use_alpha(True)
            def color_set(cb, lkey):
                self.schema.set_string(
                    lkey,
                    color_to_hex(cb.get_rgba()))
            picker.connect('color-set', color_set, key)
            table.attach_defaults(label, 0, 1, i, i + 1)
            table.attach_defaults (picker, 1, 2, i, i + 1)
            i += 1

        self.window.show_all()


def main(demoapp=None):
    app = App()
    Gtk.main()

if __name__ == '__main__':
    main()
