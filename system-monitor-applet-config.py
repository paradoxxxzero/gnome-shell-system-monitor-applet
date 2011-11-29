#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# -*- Mode: Python; py-indent-offset: 4 -*-
# vim: tabstop=4 shiftwidth=4 expandtab

# system-monitor: Gnome shell extension displaying system informations
# in gnome shell status bar, such as memory usage, cpu usage, network rates....
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

"""
system-monitor-applet-config
Tool for editing system-monitor-applet preference as
an alternative of dconf-editor

"""
from sys import exit
try:
    from gi.repository import Gtk, Gio, Gdk
except ImportError:
    print("Missing Dependencies, please install Python "
          "Gobject bindings from your distribution.")
    exit()

import os.path
import gettext
from gettext import gettext as _
gettext.textdomain('system-monitor-applet')


def color_to_hex(color):
    return "#%02x%02x%02x%02x" % (
        color.red * 255,
        color.green * 255,
        color.blue * 255,
        color.alpha * 255)


def hex_to_color(hexstr):
    return Gdk.RGBA(
        int(hexstr[1:3], 16) / 255.,
        int(hexstr[3:5], 16) / 255.,
        int(hexstr[5:7], 16) / 255.,
        int(hexstr[7:9], 16) / 255. if len(hexstr) == 9 else 1) \
        if (len(hexstr) != 4 & len(hexstr) != 5) else Gdk.RGBA(
        int(hexstr[1], 16) / 15.,
        int(hexstr[2], 16) / 15.,
        int(hexstr[3], 16) / 15.,
        int(hexstr[4], 16) / 15. if len(hexstr) == 5 else 1)


def check_sensors():
    inputs = ['temp1_input','temp2_input']
    sensor_path = '/sys/class/hwmon/'
    sensor_list = []
    string_list = []
    for j in range(5):
        for sfile in inputs:
            test = sensor_path + 'hwmon' + str(j) + '/' + sfile
            if not os.path.isfile(test):
                test = sensor_path + 'hwmon' + str(j) + '/device/' + sfile
                if not os.path.isfile(test):
                    break
            
            sensor = os.path.split(test)
            infile = open(sensor[0] + '/name', "r")
            label = infile.readline().split('\n')[0] + ' - ' + sensor[1]
            string_list.append(label)
            sensor_list.append(test)
            infile.close()
    return sensor_list, string_list



class ColorSelect:
    def __init__(self, name):
        self.label = Gtk.Label(name + ":")
        self.picker = Gtk.ColorButton()
        self.actor = Gtk.HBox()
        self.actor.add(self.label)
        self.actor.add(self.picker)
        self.picker.set_use_alpha(True)

    def set_value(self, value):
        self.picker.set_rgba(hex_to_color(value))


class IntSelect:
    def __init__(self, name):
        self.label = Gtk.Label(name + ":")
        self.spin = Gtk.SpinButton()
        self.actor = Gtk.HBox()
        self.actor.add(self.label)
        self.actor.add(self.spin)
        self.spin.set_numeric(True)

    def set_args(self, minv, maxv, incre, page):
        self.spin.set_range(minv, maxv)
        self.spin.set_increments(incre, page)

    def set_value(self, value):
        self.spin.set_value(value)


class Select:
    def __init__(self, name):
        self.label = Gtk.Label(name + ":")
        self.selector = Gtk.ComboBoxText()
        self.actor = Gtk.HBox()
        self.actor.add(self.label)
        self.actor.add(self.selector)

    def set_value(self, value):
        self.selector.set_active(value)

    def add(self, items):
        for item in items:
            self.selector.append_text(item)


def set_boolean(check, schema, name):
    schema.set_boolean(name, check.get_active())


def set_int(spin, schema, name):
    schema.set_int(name, spin.get_value_as_int())
    return False


def set_enum(combo, schema, name):
    schema.set_enum(name, combo.get_active())


def set_color(color, schema, name):
    schema.set_string(name, color_to_hex(color.get_rgba()))


def set_string(combo, schema, name, _slist):
    schema.set_string(name,  _slist[combo.get_active()])


class SettingFrame:
    def __init__(self, name, schema):
        self.schema = schema
        self.label = Gtk.Label(name)
        self.frame = Gtk.Frame()
        self.frame.set_border_width(10)
        self.vbox = Gtk.VBox(spacing=20)
        self.hbox0 = Gtk.HBox(spacing=20)
        self.hbox1 = Gtk.HBox(spacing=20)
        self.hbox2 = Gtk.HBox(spacing=20)
        self.hbox3 = Gtk.HBox(spacing=20)
        self.frame.add(self.vbox)
        self.vbox.pack_start(self.hbox0, True, False, 0)
        self.vbox.pack_start(self.hbox1, True, False, 0)
        self.vbox.pack_start(self.hbox2, True, False, 0)
        self.vbox.pack_start(self.hbox3, True, False, 0)

    def add(self, key):
        sections = key.split('-')
        if sections[1] == 'display':
            item = Gtk.CheckButton(label=_('Display'))
            item.set_active(self.schema.get_boolean(key))
            self.hbox0.add(item)
            item.connect('toggled', set_boolean, self.schema, key)
        elif sections[1] == 'refresh':
            item = IntSelect(_('Refresh Time'))
            item.set_args(50, 100000, 100, 1000)
            item.set_value(self.schema.get_int(key))
            self.hbox1.add(item.actor)
            item.spin.connect('output', set_int, self.schema, key)
        elif sections[1] == 'graph' and sections[2] == 'width':
            item = IntSelect(_('Graph Width'))
            item.set_args(1, 1000, 1, 10)
            item.set_value(self.schema.get_int(key))
            self.hbox1.add(item.actor)
            item.spin.connect('output', set_int, self.schema, key)
        elif sections[1] == 'show' and sections[2] == 'text':
            item = Gtk.CheckButton(label=_('Show Text'))
            item.set_active(self.schema.get_boolean(key))
            self.hbox0.add(item)
            item.connect('toggled', set_boolean, self.schema, key)
        elif sections[1] == 'style':
            item = Select(_('Display Style'))
            item.add((_('digit'), _('graph'), _('both')))
            item.set_value(self.schema.get_enum(key))
            self.hbox1.add(item.actor)
            item.selector.connect('changed', set_enum, self.schema, key)
        elif sections[1] == 'speed':
            item = Gtk.CheckButton(label=_('Show network speed in bits'))
            item.set_active(self.schema.get_boolean(key))
            self.hbox3.add(item)
            item.connect('toggled', set_boolean, self.schema, key)
        elif len(sections) == 3 and sections[2] == 'color':
            item = ColorSelect(_(sections[1].capitalize()))
            item.set_value(self.schema.get_string(key))
            self.hbox2.pack_end(item.actor, True, False, 0)
            item.picker.connect('color-set', set_color, self.schema, key)
        elif sections[1] == 'sensor':
            _slist, _strlist = check_sensors()
            item = Select(_('Sensor'))
            if (len(_slist) == 0):
                item.add((_('Please install lm-sensors'),))
            if (len(_slist) == 1):
                self.schema.set_string(key, _slist[0])
            item.add(_strlist)
            try:
                item.set_value(_slist.index(self.schema.get_string(key)))
            except ValueError:
                item.set_value(0)
            self.hbox3.add(item.actor)
            item.selector.connect('changed', set_string,
                                  self.schema, key, _slist)


class App:
    opt = {}
    setting_items = ('cpu', 'memory', 'swap', 'net', 'disk', 'thermal', 'freq')

    def __init__(self):
        self.schema = Gio.Settings('org.gnome.shell.extensions.system-monitor')
        keys = self.schema.keys()
        self.window = Gtk.Window(title=_('System Monitor Applet Configurator'))
        self.window.connect('destroy', Gtk.main_quit)
        self.window.set_border_width(10)
        self.items = []
        self.settings = {}
        for setting in self.setting_items:
            self.settings[setting] = SettingFrame(
                _(setting.capitalize()), self.schema)

        self.main_vbox = Gtk.VBox(spacing=10)
        self.main_vbox.set_border_width(10)
        self.hbox1 = Gtk.HBox(spacing=20)
        self.hbox1.set_border_width(10)
        self.main_vbox.pack_start(self.hbox1, False, False, 0)
        self.window.add(self.main_vbox)
        for key in keys:
            if key == 'icon-display':
                item = Gtk.CheckButton(label=_('Display Icon'))
                item.set_active(self.schema.get_boolean(key))
                self.items.append(item)
                self.hbox1.add(item)
                item.connect('toggled', set_boolean, self.schema, key)
            elif key == 'center-display':
                item = Gtk.CheckButton(label=_('Display in the Middle'))
                item.set_active(self.schema.get_boolean(key))
                self.items.append(item)
                self.hbox1.add(item)
                item.connect('toggled', set_boolean, self.schema, key)
            elif key == 'move-clock':
                item = Gtk.CheckButton(label=_('Move the clock'))
                item.set_active(self.schema.get_boolean(key))
                self.items.append(item)
                self.hbox1.add(item)
                item.connect('toggled', set_boolean, self.schema, key)
            elif key == 'background':
                item = ColorSelect(_('Background Color'))
                item.set_value(self.schema.get_string(key))
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
