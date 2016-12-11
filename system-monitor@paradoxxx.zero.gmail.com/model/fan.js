(exports => {
    const GLib = imports.gi.GLib;
    const Gio = imports.gi.Gio;
    const Lang = imports.lang;
    const St = imports.gi.St;
    const _ = imports.gettext.domain('system-monitor').gettext;
    const local = imports.misc.extensionUtils.getCurrentExtension().imports;
    const Schema = local.convenience.getSettings();
    const Style = local.model['sm-style-manager'].singleton;
    const ElementBase = local.model['element-base'].constructor;

    exports.constructor = new Lang.Class({
        Name: 'SystemMonitor.Fan',
        Extends: ElementBase,

        elt: 'fan',
        item_name: _("Fan"),
        color_name: ['fan0'],

        _init: function() {
            this.rpm = 0;
            this.display_error = true;
            this.parent();
            this.tip_format(_("rpm"));
            Schema.connect('changed::' + this.elt + '-sensor-file', Lang.bind(this, this.refresh));
            this.update();
        },
        refresh: function() {
            let sfile = Schema.get_string(this.elt + '-sensor-file');
            if(GLib.file_test(sfile, 1 << 4)) {
                let file = Gio.file_new_for_path(sfile);
                file.load_contents_async(null, Lang.bind(this, function (source, result) {
                    let as_r = source.load_contents_finish(result);
                    this.rpm = parseInt(as_r[1]);
                }));
            } else {
                if (this.display_error) {
                    global.logError("error reading: " + sfile);
                    this.display_error = false;
                }
            }
        },
        _apply: function() {
            this.text_items[0].text = this.rpm.toString();
            this.menu_items[3].text = this.rpm.toString();
            this.vals = [this.rpm / 10];
            this.tip_vals[0] = this.rpm;
        },
        create_text_items: function() {
            return [new St.Label({ style_class: Style.get("sm-status-value")}),
                    new St.Label({ text: _("rpm"), style_class: Style.get("sm-unit-label")})];
        },
        create_menu_items: function() {
            return [new St.Label(),
                    new St.Label(),
                    new St.Label(),
                    new St.Label({ style_class: Style.get("sm-value")}),
                    new St.Label(),
                    new St.Label({ text: _("rpm"), style_class: Style.get("sm-label")})];
        }
    });
})(this);
