(exports => {
    const Gio = imports.gi.Gio;
    const Lang = imports.lang;
    const St = imports.gi.St;
    const Main = imports.ui.main;
    const Panel = imports.ui.panel;
    const Power = imports.ui.status.power;

    const _ = imports.gettext.domain('system-monitor').gettext;
    const local = imports.misc.extensionUtils.getCurrentExtension().imports;
    const Schema = local.convenience.getSettings();
    const Compat = local.compat;
    const Style = local.model['sm-style-manager'].singleton;
    const ElementBase = local.model['element-base'].constructor;
    const common = imports.misc.extensionUtils.getCurrentExtension().common;

    exports.constructor =  new Lang.Class({
        Name: 'SystemMonitor.Battery',
        Extends: ElementBase,
        elt: 'battery',
        item_name: _("Battery"),
        color_name: ['batt0'],
        max: 100,
        _init: function() {
            this.icon_hidden = false;
            this.percentage = 0;
            this.timeString = '-- ';
            this._proxy = common.statusArea.aggregateMenu._power._proxy;
            if (!this._proxy)
                this._proxy = common.statusArea.battery._proxy;
            this.powerSigID = this._proxy.connect('g-properties-changed', Lang.bind(this, this.update_battery));

            //need to specify a default icon, since the contructor completes before UPower callback
            this.icon = '. GThemedIcon battery-good-symbolic battery-good';
            this.gicon = Gio.icon_new_for_string(this.icon);

            this.parent();
            this.tip_format('%');

            this.update_battery();
            this.update_tips();
            //this.hide_system_icon();
            this.update();

            //Schema.connect('changed::' + this.elt + '-hidesystem', Lang.bind(this, this.hide_system_icon));
            Schema.connect('changed::' + this.elt + '-time', Lang.bind(this, this.update_tips));
        },
        refresh: function() {
            //do nothing here?
        },
        update_battery: function(){
            // callback function for when battery stats updated.
            let battery_found = false;
            let isBattery = false;
            if (!this._proxy.GetDevicesRemote) {
                let device_type = this._proxy.Type;
                isBattery = (device_type == Power.UPower.DeviceKind.BATTERY);
                if (isBattery) {
                    battery_found = true;
                    let icon = this._proxy.IconName;
                    let percentage = this._proxy.Percentage;
                    let seconds = this._proxy.TimeToEmpty;
                    this.update_battery_value(seconds, percentage, icon);
                } else {
                    //log("SM: No battery found");
                    this.actor.hide();
                    this.menu_visible = false;
                    common.buildMenuInfo();
                }
            } else {
                this._proxy.GetDevicesRemote(Lang.bind(this, function(devices, error) {
                    if (error) {

                        log("SM: Power proxy error: " + error);
                        this.actor.hide();
                        this.menu_visible = false;
                        common.buildMenuInfo();
                        return;
                    }

                    let [result] = devices;
                    for (let i = 0; i < result.length; i++) {
                        let [, device_type, icon, percentage, , seconds] = result[i];

                        if (Compat.versionCompare(common.shellVersion, "3.9"))
                            isBattery = (device_type == Power.UPower.DeviceKind.BATTERY);
                        else
                            isBattery = (device_type == Power.UPDeviceType.BATTERY);

                        if (isBattery) {
                            battery_found = true;
                            this.update_battery_value(seconds, percentage, icon);
                            break;
                        }
                    }

                    if (!battery_found) {
                        //log("SM: No battery found")
                        this.actor.hide();
                        this.menu_visible = false;
                        common.buildMenuInfo();
                    }
                }));
            }
        },
        update_battery_value: function(seconds, percentage, icon) {
            if (seconds > 60){
                let time = Math.round(seconds / 60);
                let minutes = time % 60;
                let hours = Math.floor(time / 60);
                this.timeString = C_("battery time remaining","%d:%02d").format(hours,minutes);
            } else {
                this.timeString = '-- ';
            }
            this.percentage = Math.ceil(percentage);
            this.gicon = Gio.icon_new_for_string(icon);

            if (Schema.get_boolean(this.elt + '-display'))
                this.actor.show();
            if (Schema.get_boolean(this.elt + '-show-menu') && !this.menu_visible) {
                this.menu_visible = true;
                common.buildMenuInfo();
            }
        },
        hide_system_icon: function(override) {
            let value = Schema.get_boolean(this.elt + '-hidesystem');
            if (!override) {
                value = false;
            }
            if (value && Schema.get_boolean(this.elt + '-display')){
                if (common.shellVersion > "3.5") {
                    if (common.statusArea.battery.actor.visible) {
                        common.statusArea.battery.destroy();
                        this.icon_hidden = true;
                    }
                }
                else {
                    for (let Index = 0; Index < Main.panel._rightBox.get_children().length; Index++){
                        if(common.statusArea.battery == Main.panel._rightBox.get_children()[Index]._delegate){
                            Main.panel._rightBox.get_children()[Index].destroy();
                            common.statusArea.battery = null;
                            this.icon_hidden = true;
                            break;
                        }
                    }
                }
            } else if(this.icon_hidden){
                if (common.shellVersion < "3.5") {
                    let Indicator = new Panel.STANDARD_STATUS_AREA_SHELL_IMPLEMENTATION.battery();
                    Main.panel.addToStatusArea('battery', Indicator, Panel.STANDARD_STATUS_AREA_ORDER.indexOf('battery'));
                } else {
                    let Indicator = new Panel.PANEL_ITEM_IMPLEMENTATIONS.battery();
                    Main.panel.addToStatusArea('battery', Indicator, Main.sessionMode.panel.right.indexOf('battery'),'right');
                }
                this.icon_hidden = false;
                //Main.panel._updatePanel('right');

            }
        },
        update_tips: function(){
            let value = Schema.get_boolean(this.elt + '-time');
            if (value) {
                this.text_items[2].text = this.menu_items[5].text = 'h';
            } else {
                this.text_items[2].text = this.menu_items[5].text = '%';
            }

            this.update();
        },
        _apply: function() {
            let displayString;
            let value = Schema.get_boolean(this.elt + '-time');
            if (value){
                displayString = this.timeString;
            } else {
                displayString = this.percentage.toString();
            }
            this.text_items[1].text = this.menu_items[3].text = displayString;
            this.text_items[0].gicon = this.gicon;
            this.vals = [this.percentage];
            this.tip_vals[0] = Math.round(this.percentage);
        },
        create_text_items: function() {
            return [new St.Icon({ gicon: Gio.icon_new_for_string(this.icon),
                                  style_class: Style.get('sm-status-icon')}),
                    new St.Label({ style_class: Style.get("sm-status-value")}),
                    new St.Label({ text: '%', style_class: Style.get("sm-unit-label")})];
        },
        create_menu_items: function() {
            return [new St.Label(),
                    new St.Label(),
                    new St.Label(),
                    new St.Label({ style_class: Style.get("sm-value")}),
                    new St.Label(),
                    new St.Label({ text: '%', style_class: Style.get("sm-label")})];
        },
        destroy: function() {
            ElementBase.prototype.destroy.call(this);
            this._proxy.disconnect(this.powerSigID);
        }
    });
})(this);
