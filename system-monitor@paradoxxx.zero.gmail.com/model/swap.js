

const Swap = new Lang.Class({
    Name: 'SystemMonitor.Swap',
    Extends: ElementBase,

    elt: 'swap',
    item_name: _("Swap"),
    color_name: ['used'],
    max: 1,

    _init: function() {
        this.gtop = new GTop.glibtop_swap();
        this.parent()
        this.tip_format();
        this.update();

        GTop.glibtop_get_swap(this.gtop);
        this.total = Math.round(this.gtop.total / 1024 / 1024);
        let threshold = 4*1024; // In MiB
        this.useGiB = false;
        if (this.total > threshold)
            this.useGiB = true;
    },
    refresh: function() {
        GTop.glibtop_get_swap(this.gtop);
        let decimals = 100;
        if (this.useGiB) {
            this.swap = Math.round(this.gtop.used / 1024 / 1024 / 1024 * decimals);
            this.swap /= decimals;
            this.total = Math.round(this.gtop.total / 1024 / 1024 /1024 * decimals);
            this.total /= decimals;
        } else {
            this.swap = Math.round(this.gtop.used / 1024 / 1024);
            this.total = Math.round(this.gtop.total / 1024 / 1024);
        }
    },
    _apply: function() {
        if (this.total == 0) {
            this.vals = this.tip_vals = [0];
        } else {
            this.vals[0] = this.swap / this.total;
            this.tip_vals[0] = Math.round(this.vals[0] * 100);
        }
        this.text_items[0].text = this.tip_vals[0].toString();
        this.menu_items[0].text = this.swap.toString();
        this.menu_items[3].text = this.total.toString();
    },

    create_text_items: function() {
        return [new St.Label({ style_class: Style.get("sm-status-value")}),
                new St.Label({ text: '%', style_class: Style.get("sm-perc-label")})];
    },
    create_menu_items: function() {
        let unit = 'MiB';
        if (this.useGiB)
            unit = 'GiB';
        return [new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label(),
                new St.Label({ text: "/", style_class: Style.get("sm-label")}),
                new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label(),
                new St.Label({ text: _(unit), style_class: Style.get("sm-label")})];
    }
});
