
const Mem = new Lang.Class({
    Name: 'SystemMonitor.Mem',
    Extends: ElementBase,

    elt: 'memory',
    item_name: _("Memory"),
    color_name: ['program', 'buffer', 'cache'],
    max: 1,

    _init: function() {
        this.gtop = new GTop.glibtop_mem();
        this.mem = [0, 0, 0];
        this.parent()
        this.tip_format();
        this.update();

        GTop.glibtop_get_mem(this.gtop);
        this.total = Math.round(this.gtop.total / 1024 / 1024);
        let threshold = 4*1024; // In MiB
        this.useGiB = false;
        if (this.total > threshold)
            this.useGiB = true;
    },
    refresh: function() {
        GTop.glibtop_get_mem(this.gtop);
        let decimals = 100;
        if (this.useGiB) {
            this.mem[0] = Math.round(this.gtop.user / 1024 / 1024 /1024 * decimals);
            this.mem[0] /= decimals;
            this.mem[1] = Math.round(this.gtop.buffer / 1024 / 1024 /1024 * decimals);
            this.mem[1] /= decimals;
            this.mem[2] = Math.round(this.gtop.cached / 1024 / 1024 / 1024 * decimals);
            this.mem[2] /= decimals;
            this.total = Math.round(this.gtop.total / 1024 / 1024 / 1024 * decimals);
            this.total /= decimals;
        } else {
            this.mem[0] = Math.round(this.gtop.user / 1024 / 1024);
            this.mem[1] = Math.round(this.gtop.buffer / 1024 / 1024);
            this.mem[2] = Math.round(this.gtop.cached / 1024 / 1024);
            this.total = Math.round(this.gtop.total / 1024 / 1024);
        }
    },
    _apply: function() {
        if (this.total == 0) {
            this.vals = this.tip_vals = [0,0,0];
        } else {
            for (let i = 0;i < 3;i++) {
                this.vals[i] = this.mem[i] / this.total;
                this.tip_vals[i] = Math.round(this.vals[i] * 100);
            }
        }
        this.text_items[0].text = this.tip_vals[0].toString();
        this.menu_items[0].text = this.mem[0].toString();
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
