(exports => {
    const Lang = imports.lang;
    const St = imports.gi.St;
    const local = imports.misc.extensionUtils.getCurrentExtension().imports;
    const Schema = local.convenience.getSettings();

    exports.constructor = new Lang.Class({
        Name: 'SystemMonitor.Icon',
        _init: function() {
            this.actor = new St.Icon({
                icon_name: 'utilities-system-monitor-symbolic',
                style_class: 'system-status-icon'
            });
            this.refreshVisibility();
            Schema.connect('changed::icon-display', () => this.refreshVisibility());
        },
        refreshVisibility: function() {
            this.actor.visible = Schema.get_boolean("icon-display");
        }
    });
})(this);
