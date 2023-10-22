
'use strict';

import GObject from "gi://GObject";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import Gdk from "gi://Gdk";
import Adw from "gi://Adw";

import { ExtensionPreferences, gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import * as Config from "resource:///org/gnome/Shell/Extensions/js/misc/config.js";

const N_ = function (e) {
    return e;
};

function sm_log(message) {
    console.log(`[system-monitor-next-prefs] ${message}`);
}

const shellMajorVersion = parseInt(Config.PACKAGE_VERSION.split('.')[0]);

String.prototype.capitalize = function () {
    return this.replace(/(^|\s)([a-z])/g, function (m, p1, p2) {
        return p1 + p2.toUpperCase();
    });
};

function color_to_hex(color) {
    var output = N_('#%02x%02x%02x%02x').format(
        255 * color.red,
        255 * color.green,
        255 * color.blue,
        255 * color.alpha);
    return output;
}

function parse_bytearray(bytearray) {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytearray);
}

function check_sensors(sensor_type) {
    const hwmon_path = '/sys/class/hwmon/';
    const hwmon_dir = Gio.file_new_for_path(hwmon_path);

    const sensor_files = [];
    const sensor_labels = [];

    function get_label_from(file) {
        if (file.query_exists(null)) {
            // load_contents (and even cat) fails with "Invalid argument" for some label files
            try {
                let [success, contents] = file.load_contents(null);
                if (success) {
                    return String(parse_bytearray(contents)).split('\n')[0];
                }
            } catch (e) {
                sm_log('error loading label from file ' + file.get_path() + ': ' + e);
            }
        }
        return null;
    }

    function add_sensors_from(chip_dir, chip_label) {
        const chip_children = chip_dir.enumerate_children(
            'standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        if (!chip_children) {
            sm_log('error enumerating children of chip ' + chip_dir.get_path());
            return false;
        }

        const input_entry_regex = new RegExp('^' + sensor_type + '(\\d+)_input$');
        let info;
        let added = false;
        while ((info = chip_children.next_file(null))) {
            if (info.get_file_type() !== Gio.FileType.REGULAR) {
                continue;
            }
            const matches = info.get_name().match(input_entry_regex);
            if (!matches) {
                continue;
            }
            const input_ordinal = matches[1];
            const input = chip_children.get_child(info);
            const input_label = get_label_from(chip_dir.get_child(sensor_type + input_ordinal + '_label'));

            sensor_files.push(input.get_path());
            sensor_labels.push(chip_label + ' - ' + (input_label || input_ordinal));
            added = true;
        }
        return added;
    }

    const hwmon_children = hwmon_dir.enumerate_children(
        'standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
    if (!hwmon_children) {
        sm_log('error enumerating hwmon children');
        return [[], []];
    }

    let info;
    while ((info = hwmon_children.next_file(null))) {
        if (info.get_file_type() !== Gio.FileType.DIRECTORY || !info.get_name().match(/^hwmon\d+$/)) {
            continue;
        }
        const chip = hwmon_children.get_child(info);
        const chip_label = get_label_from(chip.get_child('name')) || chip.get_basename();

        if (!add_sensors_from(chip, chip_label)) {
            // This is here to provide compatibility with previous code, but I can't find any
            // information about sensors being stored in chip/device directory. Can we delete it?
            const chip_device = chip.get_child('device');
            if (chip_device.query_exists(null)) {
                add_sensors_from(chip_device, chip_label);
            }
        }
    }
    return [sensor_files, sensor_labels];
}

/**
 * @param args.hasBorder Whether the box has a border (true) or not
 * @param args.horizontal Whether the box is horizontal (true)
 *      or vertical (false)
 * @param args.shouldPack Determines whether a horizontal box should have
 *      uniform spacing for its children. Only applies to horizontal boxes
 * @param args.spacing The amount of spacing for a given box
 * @returns a new Box with settings specified by args
 */
function box(args = {}) {
    const options = { };

    if (typeof args.spacing !== 'undefined') {
        options.spacing = args.spacing;
    }

    if (shellMajorVersion < 40) {
        if (args.hasBorder) {
            options.border_width = 10;
        }

        return args.horizontal ?
            new Gtk.HBox(options) : new Gtk.VBox(options);
    }

    if (args.hasBorder) {
        options.margin_top = 10;
        options.margin_bottom = 10;
        options.margin_start = 10;
        options.margin_end = 10;
    }

    options.orientation = args.horizontal ?
        Gtk.Orientation.HORIZONTAL : Gtk.Orientation.VERTICAL;

    const aliasBox = new Gtk.Box(options);

    if (args.shouldPack) {
        aliasBox.set_homogeneous(true);
    }


    aliasBox.add = aliasBox.append;
    aliasBox.pack_start = aliasBox.prepend;
    // normally, this would be append; it is aliased to prepend because
    // that appears to yield the same behavior as version < 40
    aliasBox.pack_end = aliasBox.prepend;

    return aliasBox;
}

const ColorSelect = class SystemMonitor_ColorSelect {
    constructor(name) {
        this.label = new Gtk.Label({label: name + _(':')});
        this.picker = new Gtk.ColorButton();
        this.actor = box({horizontal: true, spacing: 5});
        this.actor.add(this.label);
        this.actor.add(this.picker);
        this.picker.set_use_alpha(true);
    }
    set_value(value) {
        let color = new Gdk.RGBA();

        if (Gtk.get_major_version() >= 4) {
            // GDK did not support parsing hex colours with alpha before GTK 4.
            color.parse(value);
        } else {
            let clutterColor = Clutter.Color.from_string(value)[1];
            let ctemp = [clutterColor.red, clutterColor.green, clutterColor.blue, clutterColor.alpha / 255];
            color.parse('rgba(' + ctemp.join(',') + ')');
        }

        this.picker.set_rgba(color);
    }
}

const IntSelect = class SystemMonitor_IntSelect {
    constructor(name) {
        this.label = new Gtk.Label({label: name + _(':')});
        this.spin = new Gtk.SpinButton();
        this.actor = box({horizontal: true, shouldPack: true, });
        this.actor.add(this.label);
        this.actor.add(this.spin);
        this.spin.set_numeric(true);
    }
    set_args(minv, maxv, incre, page) {
        this.spin.set_range(minv, maxv);
        this.spin.set_increments(incre, page);
    }
    set_value(value) {
        this.spin.set_value(value);
    }
}

const Select = class SystemMonitor_Select {
    constructor(name) {
        this.label = new Gtk.Label({label: name + _(':')});
        // this.label.set_justify(Gtk.Justification.RIGHT);
        this.selector = new Gtk.ComboBoxText();
        this.actor = box({horizontal: true, shouldPack: true, spacing: 5});
        this.actor.add(this.label);
        this.actor.add(this.selector);
    }
    set_value(value) {
        this.selector.set_active(value);
    }
    add(items) {
        items.forEach((item) => {
            this.selector.append_text(item);
        })
    }
}

function set_enum(combo, schema, name) {
    schema.set_enum(name, combo.get_active());
}

function set_color(color, schema, name) {
    schema.set_string(name, color_to_hex(color.get_rgba()))
}

function set_string(combo, schema, name, _slist) {
    schema.set_string(name, _slist[combo.get_active()]);
}

const SettingFrame = class SystemMonitor {
    constructor(name, schema) {
        this.schema = schema;
        this.label = new Gtk.Label({label: name});

        this.vbox = box({horizontal: false, shouldPack: true, spacing: 20});
        this.hbox0 = box({horizontal: true, shouldPack: true, spacing: 20});
        this.hbox1 = box({horizontal: true, shouldPack: true, spacing: 20});
        this.hbox2 = box({horizontal: true, shouldPack: true, spacing: 20});
        this.hbox3 = box({horizontal: true, shouldPack: true, spacing: 20});

        if (shellMajorVersion < 40) {
            this.frame = new Gtk.Frame({border_width: 10});
            this.frame.add(this.vbox);
        } else {
            this.frame = new Gtk.Frame({
                margin_top: 10,
                margin_bottom: 10,
                margin_start: 10,
                margin_end: 10
            });
            this.frame.set_child(this.vbox);
        }


        if (shellMajorVersion < 40) {
            this.vbox.pack_start(this.hbox0, true, false, 0);
            this.vbox.pack_start(this.hbox1, true, false, 0);
            this.vbox.pack_start(this.hbox2, true, false, 0);
            this.vbox.pack_start(this.hbox3, true, false, 0);
        } else {
            this.vbox.append(this.hbox0);
            this.vbox.append(this.hbox1);
            this.vbox.append(this.hbox2);
            this.vbox.append(this.hbox3);
        }
    }

    /** Enforces child ordering of first 2 boxes by label */
    _reorder() {
        if (shellMajorVersion < 40) {
            /** @return {string} label of/inside component */
            const labelOf = el => {
                if (el.get_children) {
                    return labelOf(el.get_children()[0]);
                }
                return el && el.label || '';
            };
            [this.hbox0, this.hbox1].forEach(hbox => {
                hbox.get_children()
                    .sort((c1, c2) => labelOf(c1).localeCompare(labelOf(c2)))
                    .forEach((child, index) => hbox.reorder_child(child, index));
            });
        } else {
            /** @return {string} label of/inside component */
            const labelOf = el => {
                if (el.get_label) {
                    return el.get_label();
                }
                return labelOf(el.get_first_child());
            }

            [this.hbox0, this.hbox1].forEach(hbox => {
                const children = [];
                let next = hbox.get_first_child();

                while (next !== null) {
                    children.push(next);
                    next = next.get_next_sibling();
                }

                const sorted = children
                    .sort((c1, c2) => labelOf(c1).localeCompare(labelOf(c2)));

                sorted
                    .forEach((child, index) => {
                        hbox.reorder_child_after(child, sorted[index - 1] || null);
                    });
            });
        }
    }

    add(key) {
        const configParent = key.substring(0, key.indexOf('-'));
        const config = key.substring(configParent.length + 1);
        const me = this;

        // hbox0
        if (config === 'display') {
            let item = new Gtk.CheckButton({label: _('Display')});
            this.hbox0.add(item);
            this.schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'show-text') {
            let item = new Gtk.CheckButton({label: _('Show Text')});
            this.hbox0.add(item);
            this.schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'show-menu') {
            let item = new Gtk.CheckButton({label: _('Show In Menu')});
            this.hbox0.add(item);
            this.schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        // hbox1
        } else if (config === 'refresh-time') {
            let item = new IntSelect(_('Refresh Time'));
            item.set_args(50, 100000, 1000, 5000);
            this.hbox1.add(item.actor);
            this.schema.bind(key, item.spin, 'value', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'graph-width') {
            let item = new IntSelect(_('Graph Width'));
            item.set_args(1, 1000, 1, 10);
            this.hbox1.add(item.actor);
            this.schema.bind(key, item.spin, 'value', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'style') {
            let item = new Select(_('Display Style'));
            item.add([_('digit'), _('graph'), _('both')]);
            item.set_value(this.schema.get_enum(key));
            this.hbox1.add(item.actor);
            item.selector.connect('changed', function (style) {
                set_enum(style, me.schema, key);
            });
            // Schema.bind(key, item.selector, 'active', Gio.SettingsBindFlags.DEFAULT);
        // hbox2
        } else if (config.match(/-color$/)) {
            let item = new ColorSelect(_(config.split('-')[0].capitalize()));
            item.set_value(this.schema.get_string(key));
            if (shellMajorVersion < 40) {
                this.hbox2.pack_end(item.actor, true, false, 0);
            } else {
                this.hbox2.append(item.actor);
            }
            item.picker.connect('color-set', function (color) {
                set_color(color, me.schema, key);
            });
        } else if (config.match(/sensor/)) {
            let sensor_type = configParent === 'fan' ? 'fan' : 'temp';
            let [_slist, _strlist] = check_sensors(sensor_type);
            let item = new Select(_('Sensor'));
            if (_slist.length === 0) {
                item.add([_('Please install lm-sensors')]);
            } else if (_slist.length === 1) {
                this.schema.set_string(key, _slist[0]);
            }
            item.add(_strlist);
            try {
                item.set_value(_slist.indexOf(this.schema.get_string(key)));
            } catch (e) {
                item.set_value(0);
            }
            // this.hbox3.add(item.actor);
            if (configParent === 'fan') {
                if (shellMajorVersion < 40) {
                    this.hbox2.pack_end(item.actor, true, false, 0);
                } else {
                    this.hbox2.append(item.actor);
                }
            } else if (shellMajorVersion < 40) {
                this.hbox2.pack_start(item.actor, true, false, 0);
            } else {
                this.hbox2.prepend(item.actor);
            }
            item.selector.connect('changed', function (combo) {
                set_string(combo, me.schema, key, _slist);
            });
        // hbox3
        } else if (config === 'speed-in-bits') {
            let item = new Gtk.CheckButton({label: _('Show network speed in bits')});
            this.hbox3.add(item);
            this.schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'individual-cores') {
            let item = new Gtk.CheckButton({label: _('Display Individual Cores')});
            this.hbox3.add(item);
            this.schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'time') {
            let item = new Gtk.CheckButton({label: _('Show Time Remaining')});
            this.hbox3.add(item);
            this.schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'hidesystem') {
            let item = new Gtk.CheckButton({label: _('Hide System Icon')});
            this.hbox3.add(item);
            this.schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'usage-style') {
            let item = new Select(_('Usage Style'));
            item.add([_('pie'), _('bar'), _('none')]);
            item.set_value(this.schema.get_enum(key));
            if (shellMajorVersion < 40) {
                this.hbox3.pack_end(item.actor, false, false, 20);
            } else {
                this.hbox3.append(item.actor);
            }

            item.selector.connect('changed', function (style) {
                set_enum(style, me.schema, key);
            });
        } else if (config === 'fahrenheit-unit') {
            let item = new Gtk.CheckButton({label: _('Display temperature in Fahrenheit')});
            this.hbox3.add(item);
            this.schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (config === 'threshold') {
            let item = new IntSelect(_('Temperature threshold (0 to disable)'));
            item.set_args(0, 300, 5, 5);
            this.hbox3.add(item.actor);
            this.schema.bind(key, item.spin, 'value', Gio.SettingsBindFlags.DEFAULT);
        }
        this._reorder();
    }
}

const App = class SystemMonitor_App {
    constructor(Schema) {
        const me = this;
        let setting_names = ['cpu', 'memory', 'swap', 'net', 'disk', 'gpu', 'thermal', 'fan', 'freq', 'battery'];
        let ordered_items = {};
        let setting_items = [];
        // Get preferred position of the tabs
        for (let item of setting_names) {
            ordered_items[Schema.get_int(item + '-position')] = item;
        }
        // Populate setting_items with the names in order of preference
        for (let i = 0; i < Object.keys(ordered_items).length; i++) {
            setting_items.push(ordered_items[i]);
        }
        let keys = Schema.list_keys();

        this.items = [];
        this.settings = [];
        this.frameToLabel = {}; // Maps Gtk.Widget to the English name of the setting

        setting_items.forEach((setting) => {
            this.settings[setting] = new SettingFrame(_(setting.capitalize()), Schema);
            this.frameToLabel[this.settings[setting].frame] = setting;
        });

        this.main_vbox = box({
            hasBorder: true, horizontal: false, spacing: 10});
        this.hbox1 = box({
            hasBorder: true, horizontal: true, shouldPack: true, spacing: 20});
        if (shellMajorVersion < 40) {
            this.main_vbox.pack_start(this.hbox1, false, false, 0);
        } else {
            this.main_vbox.prepend(this.hbox1);
        }

        keys.forEach((key) => {
            if (key === 'icon-display') {
                let item = new Gtk.CheckButton({label: _('Display Icon')});
                this.items.push(item)
                this.hbox1.add(item)
                Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
            } else if (key === 'center-display') {
                let item = new Gtk.CheckButton({label: _('Display in the Middle')})
                this.items.push(item)
                this.hbox1.add(item)
                Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
            } else if (key === 'compact-display') {
                let item = new Gtk.CheckButton({label: _('Compact Display')})
                this.items.push(item)
                this.hbox1.add(item)
                Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
            } else if (key === 'show-tooltip') {
                let item = new Gtk.CheckButton({label: _('Show tooltip')})
                item.set_active(Schema.get_boolean(key))
                this.items.push(item)
                this.hbox1.add(item)
                Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
            } else if (key === 'tooltip-delay-ms') {
                let item = new IntSelect(_('Tooltip delay'));
                item.set_args(0, 100000, 50, 1000);
                this.items.push(item)
                this.hbox1.add(item.actor);
                Schema.bind(key, item.spin, 'value', Gio.SettingsBindFlags.DEFAULT);
            } else if (key === 'move-clock') {
                let item = new Gtk.CheckButton({label: _('Move the clock')})
                this.items.push(item)
                this.hbox1.add(item)
                Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
            } else if (key === 'background') {
                let item = new ColorSelect(_('Background Color'))
                item.set_value(Schema.get_string(key))
                this.items.push(item)
                if (shellMajorVersion < 40) {
                    this.hbox1.pack_start(item.actor, true, false, 0)
                } else {
                    this.hbox1.prepend(item.actor)
                }
                item.picker.connect('color-set', function (color) {
                    set_color(color, Schema, key);
                });
            } else {
                let sections = key.split('-');
                if (setting_items.indexOf(sections[0]) >= 0) {
                    this.settings[sections[0]].add(key);
                }
            }
        });

        this.notebook = new Gtk.Notebook();
        this.notebook.connect('page-reordered', (widget_, pageNum_) => {
            // After a page has been moved, update the order preferences
            for (let i = 0; i < me.notebook.get_n_pages(); i++) {
                let frame = me.notebook.get_nth_page(i);
                let name = me.frameToLabel[frame];
                Schema.set_int(name + '-position', i);
            }
        });

        setting_items.forEach((setting) => {
            this.notebook.append_page(this.settings[setting].frame, this.settings[setting].label)
            this.notebook.set_tab_reorderable(this.settings[setting].frame, true);
            if (shellMajorVersion < 40) {
                this.main_vbox.show_all();
                this.main_vbox.pack_start(this.notebook, true, true, 0)
            } else {
                this.main_vbox.append(this.notebook);
            }
        });
        if (shellMajorVersion < 40) {
            this.main_vbox.show_all();
        }
    }
}

const SystemMonitorGeneralPrefsPage = GObject.registerClass({
    GTypeName: 'SystemMonitorGeneralPrefsPage',
    Template: import.meta.url.replace('prefs.js', 'ui/prefs_general_adw1.ui'),
    InternalChildren: ['background', 'icon_display', 'show_tooltip', 'move_clock',
        'compact_display', 'center_display', 'tooltip_delay_ms'],
}, class SystemMonitorGeneralPrefsPage extends Adw.PreferencesPage {
    constructor(settings, params = {}) {
        super(params);

        this._settings = settings;

        let color = new Gdk.RGBA();
        color.parse(this._settings.get_string('background'));
        this._background.set_rgba(color);

        let colorDialog = new Gtk.ColorDialog({
            modal: true,
            with_alpha: true,
        });
        this._background.set_dialog(colorDialog);

        this._background.connect('notify::rgba', colorButton => {
            this._settings.set_string('background', color_to_hex(colorButton.get_rgba()));
        });
        this._settings.connect('changed::background', () => {
            color.parse(this._settings.get_string('background'));
            this._background.set_rgba(color);
        });

        this._settings.bind('icon-display', this._icon_display,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('show-tooltip', this._show_tooltip,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('move-clock', this._move_clock,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('compact-display', this._compact_display,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('center-display', this._center_display,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind('tooltip-delay-ms', this._tooltip_delay_ms,
            'value', Gio.SettingsBindFlags.DEFAULT
        );
    }
});

const SystemMonitorExpanderRow = GObject.registerClass({
    GTypeName: 'SystemMonitorExpanderRow',
    Template: import.meta.url.replace('prefs.js', 'ui/prefs_expander_row_adw1.ui'),
    InternalChildren: ['display', 'show_menu', 'show_text', 'style', 'graph_width', 'refresh_time'],
}, class SystemMonitorExpanderRow extends Adw.ExpanderRow {
    constructor(settings, widgetType, params = {}) {
        super(params);

        this._settings = settings;

        this.title = _(widgetType.capitalize());

        this._color = new Gdk.RGBA();
        this._colorDialog = new Gtk.ColorDialog({
            modal: true,
            with_alpha: true,
        });

        this._settings.bind(`${widgetType}-display`, this._display,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind(`${widgetType}-show-menu`, this._show_menu,
            'active', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind(`${widgetType}-show-text`, this._show_text,
            'active', Gio.SettingsBindFlags.DEFAULT
        );

        this._style.set_selected(this._settings.get_enum(`${widgetType}-style`));
        this._style.connect('notify::selected', widget => {
            this._settings.set_enum(`${widgetType}-style`, widget.selected);
        });

        this._settings.bind(`${widgetType}-graph-width`, this._graph_width,
            'value', Gio.SettingsBindFlags.DEFAULT
        );
        this._settings.bind(`${widgetType}-refresh-time`, this._refresh_time,
            'value', Gio.SettingsBindFlags.DEFAULT
        );

        switch (widgetType) {
            case 'cpu': {
                let cpuColors = [
                    'cpu-user-color',
                    'cpu-iowait-color',
                    'cpu-nice-color',
                    'cpu-system-color',
                    'cpu-other-color',
                ];

                this._addColorsItem(cpuColors);

                let item = new Adw.SwitchRow({title: _('Display Individual Cores')});
                this._settings.bind('cpu-individual-cores', item,
                    'active', Gio.SettingsBindFlags.DEFAULT
                );
                this.add_row(item);
                break;
            }
            case 'freq': {
                let freqColors = [
                    'freq-freq-color',
                ];

                this._addColorsItem(freqColors);
                break;
            }
            case 'memory': {
                let memoryColors = [
                    'memory-program-color',
                    'memory-buffer-color',
                    'memory-cache-color',
                ];

                this._addColorsItem(memoryColors);
                break;
            }
            case 'swap': {
                let swapColors = [
                    'swap-used-color',
                ];

                this._addColorsItem(swapColors);
                break;
            }
            case 'net': {
                let netColors = [
                    'net-down-color',
                    'net-up-color',
                    'net-downerrors-color',
                    'net-uperrors-color',
                    'net-collisions-color',
                ];

                this._addColorsItem(netColors);

                let item = new Adw.SwitchRow({title: _('Show network speed in bits')});
                this._settings.bind('net-speed-in-bits', item,
                    'active', Gio.SettingsBindFlags.DEFAULT
                );
                this.add_row(item);
                break;
            }
            case 'disk': {
                let diskColors = [
                    'disk-read-color',
                    'disk-write-color',
                ];

                this._addColorsItem(diskColors);

                let stringListModel = new Gtk.StringList();
                stringListModel.append(_('pie'));
                stringListModel.append(_('bar'));
                stringListModel.append(_('none'));

                let item = new Adw.ComboRow({title: _('Usage Style')});
                item.set_model(stringListModel);

                item.set_selected(this._settings.get_enum('disk-usage-style'));
                item.connect('notify::selected', widget => {
                    this._settings.set_enum('disk-usage-style', widget.selected);
                });
                this.add_row(item);
                break;
            }
            case 'gpu': {
                let gpuColors = [
                    'gpu-used-color',
                    'gpu-memory-color',
                ];

                this._addColorsItem(gpuColors);
                break;
            }
            case 'thermal': {
                let thermalColors = [
                    'thermal-tz0-color',
                ];

                let [_slist, _strlist] = check_sensors('temp');
                let stringListModel = new Gtk.StringList();

                if (_slist.length === 0)
                    stringListModel.append(_('Please install lm-sensors'));
                else if (_slist.length === 1)
                    this.settings.set_string('thermal-sensor-file', _slist[0]);

                _strlist.forEach(str => {
                    stringListModel.append(str);
                });

                let item = new Adw.ComboRow({title: _('Sensor:')});
                item.set_model(stringListModel);

                try {
                    item.set_selected(_slist.indexOf(this._settings.get_string('thermal-sensor-file')));
                } catch (e) {
                    item.set_selected(0);
                }

                item.connect('notify::selected', widget => {
                    this._settings.set_string('thermal-sensor-file', _slist[widget.selected]);
                });
                this.add_row(item);
                this._addColorsItem(thermalColors);

                item = new Adw.SpinRow({
                    title: _('Temperature threshold (0 to disable)'),
                    adjustment: new Gtk.Adjustment({
                        value: 0,
                        lower: 0,
                        upper: 300,
                        step_increment: 5,
                        page_increment: 10,
                    }),
                });
                item.set_numeric(true);
                item.set_update_policy(Gtk.UPDATE_IF_VALID);
                this._settings.bind('thermal-threshold', item,
                    'value', Gio.SettingsBindFlags.DEFAULT
                );
                this.add_row(item);

                item = new Adw.SwitchRow({title: _('Display temperature in Fahrenheit')});
                this._settings.bind('thermal-fahrenheit-unit', item,
                    'active', Gio.SettingsBindFlags.DEFAULT
                );
                this.add_row(item);
                break;
            }
            case 'fan': {
                let fanColors = [
                    'fan-fan0-color',
                ];

                this._addColorsItem(fanColors);

                let [_slist, _strlist] = check_sensors('fan');
                let stringListModel = new Gtk.StringList();

                if (_slist.length === 0)
                    stringListModel.append(_('Please install lm-sensors'));
                else if (_slist.length === 1)
                    this.settings.set_string('fan-sensor-file', _slist[0]);

                _strlist.forEach(str => {
                    stringListModel.append(str);
                });

                let item = new Adw.ComboRow({title: _('Sensor:')});
                item.set_model(stringListModel);

                try {
                    item.set_selected(_slist.indexOf(this._settings.get_string('fan-sensor-file')));
                } catch (e) {
                    item.set_selected(0);
                }

                item.connect('notify::selected', widget => {
                    this._settings.set_string('fan-sensor-file', _slist[widget.selected]);
                });
                this.add_row(item);
                break;
            }
            case 'battery': {
                let batteryColors = [
                    'battery-batt0-color',
                ];

                this._addColorsItem(batteryColors);

                let item = new Adw.SwitchRow({title: _('Show Time Remaining')});
                this._settings.bind('battery-time', item,
                    'active', Gio.SettingsBindFlags.DEFAULT
                );
                this.add_row(item);

                item = new Adw.SwitchRow({title: _('Hide System Icon')});
                this._settings.bind('battery-hidesystem', item,
                    'active', Gio.SettingsBindFlags.DEFAULT
                );
                this.add_row(item);
                break;
            }
            default:
                break;
        }
    }

    _addColorsItem(colors) {
        colors.forEach(color => {
            let actionRow = new Adw.ActionRow({title: color.split('-')[1].capitalize()});
            let colorItem = new Gtk.ColorDialogButton({valign: Gtk.Align.CENTER});

            this._color.parse(this._settings.get_string(color));
            colorItem.set_rgba(this._color);
            colorItem.set_dialog(this._colorDialog);

            colorItem.connect('notify::rgba', colorButton => {
                this._settings.set_string(color, color_to_hex(colorButton.get_rgba()));
            });
            this._settings.connect(`changed::${color}`, () => {
                this._color.parse(this._settings.get_string(color));
                colorItem.set_rgba(this._color);
            });

            actionRow.add_suffix(colorItem);
            this.add_row(actionRow);
        });
    }
});

const SystemMonitorWidgetPrefsPage = GObject.registerClass({
    GTypeName: 'SystemMonitorWidgetPrefsPage',
    Template: import.meta.url.replace('prefs.js', 'ui/prefs_widget_prefs_adw1.ui'),
    InternalChildren: ['widget_prefs_group'],
}, class SystemMonitorWidgetPrefsPage extends Adw.PreferencesPage {
    constructor(settings, params = {}) {
        super(params);

        let widgetNames = [
            'cpu',
            'freq',
            'memory',
            'swap',
            'net',
            'disk',
            'gpu',
            'thermal',
            'fan',
            'battery',
        ];

        widgetNames.forEach(widgetName => {
            let item = new SystemMonitorExpanderRow(settings, widgetName);
            this._widget_prefs_group.add(item);
        });
    }
});

export default class SystemMonitorExtensionPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        let settings = this.getSettings();

        let generalSettingsPage = new SystemMonitorGeneralPrefsPage(settings);
        window.add(generalSettingsPage);
        let widgetPrefesPage = new SystemMonitorWidgetPrefsPage(settings);
        window.add(widgetPrefesPage);

        window.set_title(_('System Monitor Next Preferences'));
        window.search_enabled = true;
        window.set_default_size(585, 700);

        /*
        const page = new Adw.PreferencesPage({
            title: _("System Monitor Next Preferences"),
            icon_name: "dialog-information-symbolic",
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: _("General"),
            description: _("Configure the appearance of the extension"),
        });
        page.add(group);

        let widget = new App(this.getSettings());

        const scrolledWindow = new Gtk.ScrolledWindow();
        scrolledWindow.set_policy(Gtk.PolicyType.ALWAYS, Gtk.PolicyType.NEVER);
        scrolledWindow.set_child(widget.main_vbox);

        group.add(scrolledWindow);
        */
    }
}

