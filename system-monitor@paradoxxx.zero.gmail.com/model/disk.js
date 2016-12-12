

const Disk = new Lang.Class({
    Name: 'SystemMonitor.Disk',
    Extends: ElementBase,

    elt: 'disk',
    item_name: _("Disk"),
    color_name: ['read', 'write'],

    _init: function() {
        this.mounts = MountsMonitor.get_mounts();
        MountsMonitor.add_listener(Lang.bind(this, this.update_mounts));
        this.last = [0,0];
        this.usage = [0,0];
        this.last_time = 0;
        this.parent()
        this.tip_format(_('MiB/s'));
        this.update();
    },
    update_mounts : function(mounts){
        this.mounts = mounts;
    },
    refresh: function() {
        let accum = [0, 0];
        let lines = Shell.get_file_contents_utf8_sync('/proc/diskstats').split("\n");

        for(let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let entry = line.trim().split(/[\s]+/);
            if(entry[1] == undefined)
                break;
            accum[0] += parseInt(entry[5]);
            accum[1] += parseInt(entry[9]);
        }

        let time = GLib.get_monotonic_time() / 1000;
        let delta = (time - this.last_time) / 1000;
        if (delta > 0)
            for (let i = 0;i < 2;i++) {
                this.usage[i] =((accum[i] - this.last[i]) / delta / 1024 / 8);
                this.last[i] = accum[i];
            }
        this.last_time = time;
    },
    _apply: function() {
        this.vals = this.usage.slice();
        for (let i = 0;i < 2;i++) {
            if (this.usage[i] < 10)
                this.usage[i] = this.usage[i].toLocaleFixed(1);
            else
                this.usage[i] = Math.round(this.usage[i]);
        }
        this.tip_vals = [this.usage[0] , this.usage[1]];
        this.menu_items[0].text = this.text_items[1].text = this.tip_vals[0].toString();
        this.menu_items[3].text = this.text_items[4].text = this.tip_vals[1].toString();
    },
    create_text_items: function() {
        return [new St.Label({ text: _('R'), style_class: Style.get("sm-status-label")}),
                new St.Label({ style_class: Style.get("sm-disk-value")}),
                new St.Label({ text: Style.diskunits(), style_class: Style.get("sm-disk-unit-label")}),
                new St.Label({ text: _('W'), style_class: Style.get("sm-status-label")}),
                new St.Label({ style_class: Style.get("sm-disk-value")}),
                new St.Label({ text: Style.diskunits(), style_class: Style.get("sm-disk-unit-label")})];
    },
    create_menu_items: function() {
        return [new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label({ text:_('MiB/s'), style_class: Style.get("sm-label-left")}),
                new St.Label({ text:_('R'), style_class: Style.get("sm-label")}),
                new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label({ text:_('MiB/s'), style_class: Style.get("sm-label-left")}),
                new St.Label({ text:_('W'), style_class: Style.get("sm-label")})];
    },
});
