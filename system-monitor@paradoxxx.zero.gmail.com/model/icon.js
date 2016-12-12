
const Icon = new Lang.Class({
    Name: 'SystemMonitor.Icon',

    _init: function() {
        this.actor = new St.Icon({ icon_name: 'utilities-system-monitor-symbolic',
                                   style_class: 'system-status-icon'});
        this.actor.visible = Schema.get_boolean("icon-display");
        Schema.connect(
            'changed::icon-display',
            Lang.bind(this,
                      function () {
                          this.actor.visible = Schema.get_boolean("icon-display");
                      }));
    }
});
