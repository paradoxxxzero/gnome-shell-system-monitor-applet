const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;


const SETTINGS_SCHEMA = 'system-monitor';

const Gettext = imports.gettext.domain('system-monitor-applet');
const _ = Gettext.gettext;
const N_ = function(e) { return e; };

let extension = imports.misc.extensionUtils.getCurrentExtension();
let convenience = extension.imports.convenience;

let Schema;

function init() {
    convenience.initTranslations(extension);
    Schema = convenience.getSettings(extension, SETTINGS_SCHEMA);
	
}

String.prototype.capitalize = function(){
   return this.replace( /(^|\s)([a-z])/g , function(m,p1,p2){ return p1+p2.toUpperCase(); } );
};
  
function color_to_hex(color){
    output = N_("#%02x%02x%02x%02x").format(color.red * 255, color.green * 255,
                                            color.blue * 255, color.alpha * 255);
    return output;
}

function check_sensors(){
    let inputs = ['temp1_input','temp2_input'];
    let sensor_path = '/sys/class/hwmon/';
    let sensor_list = [];
    let string_list = [];
    let test;
    for (let j=0; j <5; j++){
            for (let k=0; k < inputs.length; k++){
                test = sensor_path + 'hwmon' + j + '/' + inputs[k];
                if(!GLib.file_test(test,1<<4)){
                    test = sensor_path + 'hwmon' + j + '/device/' + inputs[k];
                    if(!GLib.file_test(test,1<<4)){
                       continue;
                }
            }
            let sensor = test.substr(0, test.lastIndexOf('/'));
            let result = GLib.file_get_contents(sensor + '/name');
            let label;
	     if (result[0]){
                label = N_('' + result[1]).split('\n')[0];
            }
            string_list.push(label.capitalize() + ' - ' + inputs[k].split('_')[0].capitalize());
            sensor_list.push(test);   
            }
    }
    return [sensor_list, string_list];  
};


const ColorSelect = new Lang.Class({
	Name: 'SystemMonitor.ColorSelect',

    _init: function(name) {
        this.label = new Gtk.Label({label: name + _(":")});
        this.picker = new Gtk.ColorButton();
        this.actor = new Gtk.HBox();
        this.actor.add(this.label);
        this.actor.add(this.picker);
        this.picker.set_use_alpha(true);
    },
    set_value: function(value){
        let clutterColor = new Clutter.Color();
    	clutterColor.from_string(value);
        let color = new Gdk.RGBA();
        let ctemp = [clutterColor.red,clutterColor.green,clutterColor.blue,clutterColor.alpha/255];
        color.parse('rgba(' + ctemp.join(',') + ')');	
        this.picker.set_rgba(color);
    }
});

const IntSelect = new Lang.Class({
	Name: 'SystemMonitor.IntSelect',

    _init: function(name) {
        this.label = new Gtk.Label({label: name + _(":")});
        this.spin = new Gtk.SpinButton();
        this.actor = new Gtk.HBox();
        this.actor.add(this.label);
        this.actor.add(this.spin);
        this.spin.set_numeric(true);
    },
    set_args: function(minv, maxv, incre, page){
        this.spin.set_range(minv, maxv);
        this.spin.set_increments(incre, page);
    },
    set_value: function(value){
        this.spin.set_value(value);
    }
});

const Select = new Lang.Class({
	Name: 'SystemMonitor.Select',

    _init: function(name) {
        this.label = new Gtk.Label({label: name + _(":")});
        this.selector = new Gtk.ComboBoxText();
        this.actor = new Gtk.HBox();
        this.actor.add(this.label);
        this.actor.add(this.selector);
    },
    set_value: function(value){
        this.selector.set_active(value);
    },
    add: function(items){   
        items.forEach(Lang.bind(this, function(item){
            this.selector.append_text(item);
        }));
    }
});

function set_enum(combo, schema, name){
    Schema.set_enum(name, combo.get_active());
}

function set_color(color, schema, name){
    Schema.set_string(name, color_to_hex(color.get_rgba()))
}

function set_string(combo, schema, name, _slist){
    Schema.set_string(name, _slist[combo.get_active()]);
}

const SettingFrame = new Lang.Class({
	Name: 'SystemMonitor.SettingFrame',

    _init: function(name, schema){
        this.schema = schema;
        this.label = new Gtk.Label({label: name});
        this.frame = new Gtk.Frame({border_width: 10});
        
        this.vbox = new Gtk.VBox({spacing:20});
        this.hbox0 = new Gtk.HBox({spacing:20});
        this.hbox1 = new Gtk.HBox({spacing:20});
        this.hbox2 = new Gtk.HBox({spacing:20});
        this.hbox3 = new Gtk.HBox({spacing:20});
        this.frame.add(this.vbox);
        this.vbox.pack_start(this.hbox0, true, false, 0);
        this.vbox.pack_start(this.hbox1, true, false, 0);
        this.vbox.pack_start(this.hbox2, true, false, 0);
        this.vbox.pack_start(this.hbox3, true, false, 0);
	
    },
    add: function(key){
        let sections = key.split('-')
        if (sections[1] == 'display'){
            let item = new Gtk.CheckButton({label:_('Display')});
            this.hbox0.add(item);
			Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
			
        } else if (sections[1] == 'refresh'){
            let item = new IntSelect(_('Refresh Time'));
            item.set_args(50, 100000, 1000, 5000);
            this.hbox1.add(item.actor);
			Schema.bind(key, item.spin, 'value', Gio.SettingsBindFlags.DEFAULT);
        } else if (sections[1] == 'graph' && sections[2] == 'width'){
            let item = new IntSelect(_('Graph Width'));
            item.set_args(1, 1000, 1, 10);
            this.hbox1.add(item.actor);
        	Schema.bind(key, item.spin, 'value', Gio.SettingsBindFlags.DEFAULT);
        } else if (sections[1] == 'show' && sections[2] == 'text'){
            let item = new Gtk.CheckButton({label:_('Show Text')});
            this.hbox0.add(item);
			Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (sections[1] == 'show' && sections[2] == 'menu'){
            let item = new Gtk.CheckButton({label:_('Show In Menu')});
            this.hbox0.add(item);
         	Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (sections[1] == 'style'){
            let item = new Select(_('Display Style'));
            item.add([_('digit'), _('graph'), _('both')]);
            item.set_value(this.schema.get_enum(key));
            this.hbox1.add(item.actor);
            item.selector.connect('changed', function(style){
                set_enum(style, Schema, key);
            });
			//Schema.bind(key, item.selector, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (sections[1] == 'speed'){
            let item = new Gtk.CheckButton({label:_('Show network speed in bits')});
            this.hbox3.add(item);
            Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (sections.length == 3 && sections[2] == 'color'){
            let item = new ColorSelect(_(sections[1].capitalize()));
            item.set_value(this.schema.get_string(key));
            this.hbox2.pack_end(item.actor, true, false, 0);
            item.picker.connect('color-set', function(color){
                set_color(color, Schema, key);
            });
        } else if (sections[1] == 'sensor'){
            let [_slist, _strlist] = check_sensors();
            let item = new Select(_('Sensor'));
            if (_slist.length == 0){
                item.add([_('Please install lm-sensors')]);
            } else if (_slist.length == 1){
                this.schema.set_string(key, _slist[0]);
            }
            item.add(_strlist);
            try {
                item.set_value(_slist.indexOf(this.schema.get_string(key)));
            } catch (e) {
                item.set_value(0);
            }
            this.hbox3.add(item.actor);
            item.selector.connect('changed', function(combo){
                set_string(combo, Schema, key, _slist);
            });
        } else if (sections[1] == 'time'){
            let item = new Gtk.CheckButton({label:_('Show Time Remaining')});
            this.hbox3.add(item);
            Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (sections[1] == 'hidesystem'){
            let item = new Gtk.CheckButton({label:_('Hide System Icon')});
            this.hbox3.add(item);
            Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
        } else if (sections[1] == 'usage' && sections[2] == 'style'){
            let item = new Select(_('Usage Style'));
            item.add([_('pie'), _('bar'), _('none')]);
            item.set_value(this.schema.get_enum(key));
            this.hbox3.pack_end(item.actor,false,false,20);
            
            item.selector.connect('changed', function(style){
                set_enum(style, Schema, key);
            });
        }
    }
});

const App = new Lang.Class({
	Name: 'SystemMonitor.App',

    _init: function(){

        let setting_items = ['cpu', 'memory', 'swap', 'net', 'disk', 'thermal', 'freq', 'battery'];
        let keys = Schema.list_keys();
    
        this.items = [];
        this.settings = [];
    
        setting_items.forEach(Lang.bind(this, function(setting){
            this.settings[setting] = new SettingFrame(_(setting.capitalize()), Schema);
        }));
    
        this.main_vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL,
                                       spacing: 10,
                                       border_width: 10});
        this.hbox1 = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,
                                  spacing: 20,
                                  border_width: 10});
        this.main_vbox.pack_start(this.hbox1, false, false, 0);
    
        keys.forEach(Lang.bind(this, function(key){
            if (key == 'icon-display'){
                let item = new Gtk.CheckButton({label: _('Display Icon')});
                //item.set_active(Schema.get_boolean(key))
                this.items.push(item)
                this.hbox1.add(item)
                /*item.connect('toggled', function(check){
                    set_boolean(check, Schema, key);
                });*/
				Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
            } else if (key == 'center-display'){
                let item = new Gtk.CheckButton({label: _('Display in the Middle')})
                //item.set_active(Schema.get_boolean(key))
                this.items.push(item)
                this.hbox1.add(item)
 				Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);		
            } else if (key == 'move-clock'){
                let item = new Gtk.CheckButton({label:_('Move the clock')})
                //item.set_active(Schema.get_boolean(key))
                this.items.push(item)
                this.hbox1.add(item)
                Schema.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);
            } else if (key == 'background'){
                let item = new ColorSelect(_('Background Color'))
                item.set_value(Schema.get_string(key))
                this.items.push(item)
                this.hbox1.pack_start(item.actor, true, false, 0)
                item.picker.connect('color-set', function(color){
                    set_color(color, Schema, key);
                });
            } else {
                let sections = key.split('-');
                if (setting_items.indexOf(sections[0]) >= 0){
                    this.settings[sections[0]].add(key);   
                }
            }    
        }));
        this.notebook = new Gtk.Notebook()
        setting_items.forEach(Lang.bind(this, function(setting){        
            this.notebook.append_page(this.settings[setting].frame, this.settings[setting].label)
            this.main_vbox.pack_start(this.notebook, true, true, 0)
            this.main_vbox.show_all();
        }));
    this.main_vbox.show_all();
    }
});

function buildPrefsWidget(){
    let widget = new App();
    return widget.main_vbox;
};
