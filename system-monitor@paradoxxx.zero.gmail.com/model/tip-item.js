(exports => {
    const Lang = imports.lang;
    const PopupMenu = imports.ui.popupMenu;

    exports.constructor = new Lang.Class({
        Name: 'SystemMonitor.TipItem',
        Extends: PopupMenu.PopupBaseMenuItem,
        _init: function() {
            PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
            this.actor.remove_style_class_name('popup-menu-item');
            this.actor.add_style_class_name('sm-tooltip-item');
        }
    });
})(this);
