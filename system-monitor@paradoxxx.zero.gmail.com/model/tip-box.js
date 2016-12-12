
const TipBox = new Lang.Class({
    Name: 'SystemMonitor.TipBox',

    _init: function() {
        this.actor = new St.BoxLayout({ reactive: true});
        this.actor._delegate = this;
        this.set_tip(new TipMenu(this.actor))
        this.in_to = this.out_to = 0;
        this.actor.connect('enter-event', Lang.bind(this, this.on_enter));
        this.actor.connect('leave-event', Lang.bind(this, this.on_leave));
    },
    set_tip: function(tipmenu) {
        if (this.tipmenu)
            this.tipmenu.destroy();
        this.tipmenu = tipmenu;
        if (this.tipmenu) {
            Main.uiGroup.add_actor(this.tipmenu.actor);
            this.hide_tip();
        }
    },
    show_tip: function() {
        if (!this.tipmenu)
            return;
        this.tipmenu.open();
        if (this.in_to) {
            Mainloop.source_remove(this.in_to);
            this.in_to = 0;
        }
    },
    hide_tip: function() {
        if (!this.tipmenu)
            return;
        this.tipmenu.close();
        if (this.out_to) {
            Mainloop.source_remove(this.out_to);
            this.out_to = 0;
        }
        if (this.in_to) {
            Mainloop.source_remove(this.in_to);
            this.in_to = 0;
        }
    },
    on_enter: function() {
        let show_tooltip = Schema.get_boolean('show-tooltip');

        if (!show_tooltip)
            return;

        if (this.out_to) {
            Mainloop.source_remove(this.out_to);
            this.out_to = 0;
        }
        if (!this.in_to) {
            this.in_to = Mainloop.timeout_add(500,
                                              Lang.bind(this,
                                                        this.show_tip));
        }
    },
    on_leave: function() {
        if (this.in_to) {
            Mainloop.source_remove(this.in_to);
            this.in_to = 0;
        }
        if (!this.out_to) {
            this.out_to = Mainloop.timeout_add(500,
                                               Lang.bind(this,
                                                         this.hide_tip));
        }
    },
    destroy: function() {
        if (this.in_to) {
            Mainloop.source_remove(this.in_to);
            this.in_to = 0;
        }

        if (this.out_to) {
            Mainloop.source_remove(this.out_to);
            this.out_to = 0;
        }

        this.actor.destroy();
    },
});
