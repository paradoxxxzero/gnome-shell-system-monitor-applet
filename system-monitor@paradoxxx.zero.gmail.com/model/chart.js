(exports => {
    const Clutter = imports.gi.Clutter;
    const Lang = imports.lang;
    const St = imports.gi.St;

    const local = imports.misc.extensionUtils.getCurrentExtension().imports;
    const Schema = local.convenience.getSettings();
    const Compat = local.compat;
    const Style = local.model['sm-style-manager'].singleton;
    const common = imports.misc.extensionUtils.getCurrentExtension().common;

    exports.constructor = new Lang.Class({
        Name: 'SystemMonitor.Chart',

        _init: function(width, height, parent) {
            this.actor = new St.DrawingArea({ style_class: Style.get("sm-chart"), reactive: false});
            this.parentC = parent;
            this.actor.set_width(this.width=width);
            this.actor.set_height(this.height=height);
            this.actor.connect('repaint', Lang.bind(this, this._draw));
            this.data = [];
            for (let i = 0;i < this.parentC.colors.length;i++)
                this.data[i] = [];
        },
        update: function() {
            let data_a = this.parentC.vals;
            if (data_a.length != this.parentC.colors.length) return;
            let accdata = [];
            for (let l = 0 ; l < data_a.length ; l++) {
                accdata[l] = (l === 0) ? data_a[0] : accdata[l - 1] + ((data_a[l] > 0) ? data_a[l] : 0);
                this.data[l].push(accdata[l]);
                if (this.data[l].length > this.width)
                    this.data[l].shift();
            }
            if (!this.actor.visible) return;
            this.actor.queue_repaint();
        },
        _draw: function() {
            if (!this.actor.visible)
                return;
            let [width, height] = this.actor.get_surface_size();
            let cr = this.actor.get_context();
            let max;
            if (this.parentC.max) {
                max = this.parentC.max;
            } else {
                max = Math.max.apply(this, this.data[this.data.length - 1]);
                max = Math.max(1, Math.pow(2, Math.ceil(Math.log(max) / Math.log(2))));
            }
            Clutter.cairo_set_source_color(cr, common.backgroundColor);
            cr.rectangle(0, 0, width, height);
            cr.fill();
            for (let i = this.parentC.colors.length - 1;i >= 0;i--) {
                cr.moveTo(width, height);
                for (let j = this.data[i].length - 1;j >= 0;j--)
                    cr.lineTo(width - (this.data[i].length - 1 - j), (1 - this.data[i][j] / max) * height);
                cr.lineTo(width - (this.data[i].length - 1), height);
                cr.closePath();
                Clutter.cairo_set_source_color(cr, this.parentC.colors[i]);
                cr.fill();
            }
            if (Compat.versionCompare(common.shellVersion, "3.7.4")) {
                cr.$dispose();
            }
        },
        resize: function(schema, key) {
            let old_width = this.width;
            this.width = Schema.get_int(key);
            if (old_width == this.width)
                return;
            this.actor.set_width(this.width);
            if (this.width < this.data[0].length)
                for (let i = 0;i < this.parentC.colors.length;i++)
                    this.data[i] = this.data[i].slice(-this.width);
        }
    });
})(this);
