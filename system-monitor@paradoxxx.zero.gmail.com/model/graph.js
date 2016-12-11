(exports => {
    const Lang = imports.lang;
    const St = imports.gi.St;
    const PopupMenu = imports.ui.popupMenu;
    let GTop;
    try {
        GTop = imports.gi.GTop;
    }
    catch(e) {/* handled earlier */}

    const local = imports.misc.extensionUtils.getCurrentExtension().imports;
    const Style = local.model['sm-style-manager'].singleton;
    const Compat = local.compat;

    exports.constructor = new Lang.Class({
        Name: 'SystemMonitor.Graph',
        menu_item: '',
        _init: function() {
            this.actor = new St.DrawingArea({ style_class: Style.get("sm-chart"), reactive: false});
            this.width = arguments[0][0];
            this.height = arguments[0][1];
            this.actor.set_width(this.width);
            this.actor.set_height(this.height);
            this.actor.connect('repaint', Lang.bind(this, this._draw));
            this.gtop = new GTop.glibtop_fsusage();
            // FIXME Handle colors correctly
            this.colors = ["#444", "#666", "#888", "#aaa", "#ccc", "#eee"];
            for(let color in this.colors) {
                this.colors[color] = Compat.color_from_string(this.colors[color]);
            }

        },
        create_menu_item: function(){
            this.menu_item = new PopupMenu.PopupBaseMenuItem({reactive: false});
            this.menu_item.actor.add(this.actor, {span: -1, expand: true});
            //tray.menu.addMenuItem(this.menu_item);
        },
        show: function(visible){
            this.menu_item.actor.visible = visible;
        }
    });
})(this);
