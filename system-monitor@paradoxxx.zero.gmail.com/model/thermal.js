

const Thermal = new Lang.Class({
    Name: 'SystemMonitor.Thermal',
    Extends: ElementBase,

    elt: 'thermal',
    item_name: _("Thermal"),
    color_name: ['tz0'],
    max: 100,
    _init: function() {
        this.temperature = '-- ';
        this.display_error = true;
        this.parent()
        this.tip_format('\u2103');
        Schema.connect('changed::' + this.elt + '-sensor-file', Lang.bind(this, this.refresh));
        this.update();
    },
    refresh: function() {
        let sfile = Schema.get_string(this.elt + '-sensor-file');
        if(GLib.file_test(sfile, 1 << 4)) {
            let file = Gio.file_new_for_path(sfile);
            file.load_contents_async(null, Lang.bind(this, function (source, result) {
                let as_r = source.load_contents_finish(result)
                this.temperature = Math.round(parseInt(as_r[1]) / 1000);
            }));
        } else {
            if (this.display_error) {
                global.logError("error reading: " + sfile);
                this.display_error = false;
            }
        }
    },
    _apply: function() {
        this.text_items[0].text = this.menu_items[3].text = this.temperature.toString();
        //Making it looks better in chart.
        //this.vals = [this.temperature / 100];
        this.vals = [this.temperature];
        this.tip_vals[0] = this.temperature;
    },
    create_text_items: function() {
        return [new St.Label({ style_class: Style.get("sm-status-value")}),
                new St.Label({ text: '\u2103', style_class: Style.get("sm-temp-label")})];
    },
    create_menu_items: function() {
        return [new St.Label(),
                new St.Label(),
                new St.Label(),
                new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label(),
                new St.Label({ text: '\u2103', style_class: Style.get("sm-label")})];
    }
});
