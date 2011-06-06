#!/usr/bin/env python
# -*- Mode: Python; py-indent-offset: 4 -*-
# vim: tabstop=4 shiftwidth=4 expandtab

# system-monitor: Gnome shell extension displaying system informations
# in gnome shell status bar, such as memory usage, cpu usage, network rates…
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


def up_first(string):
    return string[0].upper() + string[1:]


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
        int(hexstr[7:9], 16) / 255 \
            if len(hexstr) == 9 \
            else 1) if (len(hexstr) != 4 & len(hexstr) != 5) \
            else Gdk.RGBA(
            int(hexstr[1], 16) / 15,
            int(hexstr[2], 16) / 15,
            int(hexstr[3], 16) / 15,
            int(hexstr[4], 16) / 15 if len(hexstr) == 5 else 1)


class ColorSelect:
    def __init__(self, name, value):
        self.label = Gtk.Label(name + ":")
        self.picker = Gtk.ColorButton()
        self.actor = Gtk.HBox()
        self.actor.add(self.label)
        self.actor.add(self.picker)
        self.picker.set_use_alpha(True)
        self.picker.set_rgba(hex_to_color(value))


class IntSelect:
    def __init__(self, name, value, minv, maxv, incre, page):
        self.label = Gtk.Label(name + ":")
        self.spin = Gtk.SpinButton()
        self.actor = Gtk.HBox()
        self.actor.add(self.label)
        self.actor.add(self.spin)
        self.spin.set_range(minv, maxv)
        self.spin.set_increments(incre, page)
        self.spin.set_numeric(True)
        self.spin.set_value(value)


class Select:
    def __init__(self, name, value, items):
        self.label = Gtk.Label(name + ":")
        self.selector = Gtk.ComboBoxText()
        self.actor = Gtk.HBox()
        for item in items:
            self.selector.append_text(item)
        self.selector.set_active(value)
        self.actor.add(self.label)
        self.actor.add(self.selector)


def set_boolean(check, schema, name):
    schema.set_boolean(name, check.get_active())


def set_int(spin, schema, name):
    schema.set_int(name, spin.get_value_as_int())
    return False


def set_enum(combo, schema, name):
    schema.set_enum(name, combo.get_active())


def set_color(cb, schema, name):
    schema.set_string(name, color_to_hex(cb.get_rgba()))


class SettingFrame:
    def __init__(self, name, schema):
        self.schema = schema
        self.label = Gtk.Label(name)
        self.frame = Gtk.Frame()
        self.frame.set_border_width(10)
        self.vbox = Gtk.VBox(spacing = 20)
        self.hbox0 = Gtk.HBox(spacing = 20)
        self.hbox1 = Gtk.HBox(spacing = 20)
        self.hbox2 = Gtk.HBox(spacing = 20)
        self.frame.add(self.vbox)
        self.vbox.pack_start(self.hbox0, True, False, 0)
        self.vbox.pack_start(self.hbox1, True, False, 0)
        self.vbox.pack_start(self.hbox2, True, False, 0)

    def add(self, key):
        sections = key.split('-')
        if sections[1] == 'display':
            item = Gtk.CheckButton(label='Display')
            item.set_active(self.schema.get_boolean(key))
            self.hbox0.add(item)
            item.connect('toggled', set_boolean, self.schema, key)
        elif sections[1] == 'refresh':
            item = IntSelect('Refresh Time',
                              self.schema.get_int(key),
                              50, 100000, 100, 1000)
            self.hbox1.add(item.actor)
            item.spin.connect('output', set_int, self.schema, key)
        elif sections[1] == 'graph' and sections[2] == 'width':
            item = IntSelect('Graph Width',
                              self.schema.get_int(key),
                              1, 1000, 1, 10)
            self.hbox1.add(item.actor)
            item.spin.connect('output', set_int, self.schema, key)
        elif sections[1] == 'show' and sections[2] == 'text':
            item = Gtk.CheckButton(label='Show Text')
            item.set_active(self.schema.get_boolean(key))
            self.hbox0.add(item)
            item.connect('toggled', set_boolean, self.schema, key)
        elif sections[1] == 'style':
            item = Select('Display Style',
                          self.schema.get_enum(key),
                          ('digit', 'graph', 'both'))
            self.hbox1.add(item.actor)
            item.selector.connect('changed', set_enum, self.schema, key)
        elif len(sections) == 3 and sections[2] == 'color':
            item = ColorSelect(up_first(sections[1]),
                                self.schema.get_string(key))
            self.hbox2.pack_end(item.actor, True, False, 0)
            item.picker.connect('color-set', set_color, self.schema, key)


class App:
    opt = {}
    setting_items = ('cpu', 'memory', 'swap', 'net', 'disk')

    def __init__(self):
        self.schema = Gio.Settings('org.gnome.shell.extensions.system-monitor')
        keys = self.schema.keys()
        self.window = Gtk.Window(title='System Monitor Applet Configurator')
        self.window.connect('destroy', Gtk.main_quit)
        self.window.set_border_width(10)
        self.items = []
        self.settings = {}
        for setting in self.setting_items:
            self.settings[setting] = SettingFrame(
                up_first(setting), self.schema)

        self.main_vbox = Gtk.VBox(spacing = 10)
        self.main_vbox.set_border_width(10)
        self.hbox1 = Gtk.HBox(spacing = 20)
        self.hbox1.set_border_width(10)
        self.main_vbox.pack_start(self.hbox1, False, False, 0)
        self.window.add(self.main_vbox)
        for key in keys:
            if key == 'icon-display':
                item = Gtk.CheckButton(label='Display Icon')
                item.set_active(self.schema.get_boolean(key))
                self.items.append(item)
                self.hbox1.add(item)
                item.connect('toggled', set_boolean, self.schema, key)
            elif key == 'center-display':
                item = Gtk.CheckButton(label='Display in the Middle')
                item.set_active(self.schema.get_boolean(key))
                self.items.append(item)
                self.hbox1.add(item)
                item.connect('toggled', set_boolean, self.schema, key)
            elif key == 'background':
                item = ColorSelect('Background Color',
                                    self.schema.get_string(key))
                self.items.append(item)
                self.hbox1.pack_start(item.actor, True, False, 0)
                item.picker.connect('color-set', set_color, self.schema, key)
            else:
                sections = key.split('-')
                if sections[0] in self.setting_items:
                    self.settings[sections[0]].add(key)

        self.notebook = Gtk.Notebook()
        for setting in self.setting_items:
            self.notebook.append_page(
                self.settings[setting].frame, self.settings[setting].label)
        self.main_vbox.pack_start(self.notebook, True, True, 0)
        self.window.set_resizable(False)
        self.window.show_all()


def main():
    App()
    Gtk.main()

if __name__ == '__main__':
    main()
