

const Freq = new Lang.Class({
    Name: 'SystemMonitor.Freq',
    Extends: ElementBase,

    elt: 'freq',
    item_name: _("Freq"),
    color_name: ['freq'],
    _init: function() {
        this.freq = 0;
        this.parent()
        this.tip_format('MHz');
        this.update();
    },
    refresh: function() {
        let lines = Shell.get_file_contents_utf8_sync('/proc/cpuinfo').split("\n");
        for(let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if(line.search(/cpu mhz/i) < 0)
                continue;
            this.freq = parseInt(line.substring(line.indexOf(':') + 2));
            break;
        }
    },
    _apply: function() {
        let value = this.freq.toString();
        this.text_items[0].text = value + ' ';
        this.tip_vals[0] = value;
        this.menu_items[3].text = value;
    },
    create_text_items: function() {
        return [new St.Label({ style_class: Style.get("sm-big-status-value")}),
                new St.Label({ text: 'MHz', style_class: Style.get("sm-perc-label")})];

    },
    create_menu_items: function() {
        return [new St.Label(),
                new St.Label(),
                new St.Label(),
                new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label(),
                new St.Label({ text: 'MHz', style_class: Style.get("sm-label")})];
    }
});
