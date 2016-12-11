(exports => {
    const Clutter = imports.gi.Clutter;
    const Lang = imports.lang;
    let GTop;
    try {
        GTop = imports.gi.GTop;
    }
    catch(e) {/* handled earlier */}

    const local = imports.misc.extensionUtils.getCurrentExtension().imports;
    const Compat = local.compat;
    const Style = local.model['sm-style-manager'].singleton;
    const Graph = local.model.graph.constructor;
    const MountsMonitor = local.model['sm-mounts-monitor'].singleton;
    const common = imports.misc.extensionUtils.getCurrentExtension().common;

    exports.constructor = new Lang.Class({
        Name: 'SystemMonitor.Bar',
        Extends: Graph,
        _init: function() {
            this.mounts = MountsMonitor.get_mounts();
            MountsMonitor.add_listener(Lang.bind(this, this.update_mounts));
            this.thickness = 15;
            this.fontsize = Style.bar_fontsize();
            this.parent(arguments);
            this.actor.set_height(this.mounts.length * (3 * this.thickness) / 2 );
        },
        _draw: function(){
            if (!this.actor.visible) return;
            this.actor.set_height(this.mounts.length * (3 * this.thickness) / 2 );
            let [width] = this.actor.get_surface_size();
            let cr = this.actor.get_context();

            let x0 = width/8;
            let y0 = this.thickness/2;
            cr.setLineWidth(this.thickness);
            cr.setFontSize(this.fontsize);
            for (let mount in this.mounts) {
                GTop.glibtop_get_fsusage(this.gtop, this.mounts[mount]);
                let perc_full = (this.gtop.blocks - this.gtop.bfree)/this.gtop.blocks;
                Clutter.cairo_set_source_color(cr, this.colors[mount % this.colors.length]);
                cr.moveTo(2*x0,y0);
                cr.relLineTo(perc_full*0.6*width, 0);
                cr.moveTo(0, y0+this.thickness/3);
                cr.showText(this.mounts[mount]);
                //cr.stroke();
                cr.moveTo(width - x0, y0+this.thickness/3);
                cr.showText(Math.round(perc_full*100).toString()+'%');
                cr.stroke();
                y0 += (3 * this.thickness) / 2;
            }
            if (Compat.versionCompare(common.shellVersion, "3.7.4")) {
                cr.$dispose();
            }
        },
        update_mounts: function(mounts) {
            this.mounts = mounts;
            this.actor.queue_repaint();
        }
    });
})(this);
