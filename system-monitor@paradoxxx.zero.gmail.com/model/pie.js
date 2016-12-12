const Pie = new Lang.Class({
    Name: 'SystemMonitor.Pie',
    Extends: Graph,
    _init: function() {
        this.mounts = MountsMonitor.get_mounts();
        MountsMonitor.add_listener(Lang.bind(this, this.update_mounts));
        this.parent(arguments);
    },
    _draw: function() {
        if (!this.actor.visible) return;
        let [width, height] = this.actor.get_surface_size();
        let cr = this.actor.get_context();
        let xc = width / 2;
        let yc = height / 2;
        let rc = Math.min(xc, yc);
        let pi = Math.PI;
        function arc(r, value, max, angle) {
            if(max == 0) return angle;
            let new_angle = angle + (value * 2 * pi / max);
            cr.arc(xc, yc, r, angle, new_angle);
            return new_angle;
        }
        let rings = (this.mounts.length > 7?this.mounts.length:7);
        let thickness = (2 * rc) / (3 * rings);
        let fontsize = Style.pie_fontsize();
        let r = rc - (thickness / 2);
        cr.setLineWidth(thickness);
        cr.setFontSize(fontsize);
        for (let mount in this.mounts) {
            GTop.glibtop_get_fsusage(this.gtop, this.mounts[mount]);
            Clutter.cairo_set_source_color(cr, this.colors[mount % this.colors.length]);
            arc(r, this.gtop.blocks - this.gtop.bfree, this.gtop.blocks, -pi/2);
            cr.moveTo(0, yc - r + thickness / 2);
            cr.showText(this.mounts[mount]);
            cr.stroke();
            r -= (3 * thickness) / 2;
        }
        if (Compat.versionCompare(shell_Version, "3.7.4")) {
            cr.$dispose();
        }
    },
    update_mounts: function(mounts){
        this.mounts = mounts;
        this.actor.queue_repaint();
    }
});
