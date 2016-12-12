
const TipMenu = new Lang.Class({
    Name: 'SystemMonitor.TipMenu',
    Extends: PopupMenu.PopupMenuBase,

    _init: function(sourceActor){
        //PopupMenu.PopupMenuBase.prototype._init.call(this, sourceActor, 'sm-tooltip-box');
        this.parent(sourceActor, 'sm-tooltip-box');
        this.actor = new Shell.GenericContainer();
        this.actor.connect('get-preferred-width',
                           Lang.bind(this, this._boxGetPreferredWidth));
        this.actor.connect('get-preferred-height',
                           Lang.bind(this, this._boxGetPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._boxAllocate));
        this.actor.add_actor(this.box);
    },
    _boxGetPreferredWidth: function (actor, forHeight, alloc) {
        //let columnWidths = this.getColumnWidths();
        //this.setColumnWidths(columnWidths);

        [alloc.min_size, alloc.natural_size] = this.box.get_preferred_width(forHeight);
    },
    _boxGetPreferredHeight: function (actor, forWidth, alloc) {
        [alloc.min_size, alloc.natural_size] = this.box.get_preferred_height(forWidth);
    },
    _boxAllocate: function (actor, box, flags) {
        this.box.allocate(box, flags);
    },
    _shift: function() {
        //Probably old but works
        let node = this.sourceActor.get_theme_node();
        let contentbox = node.get_content_box(this.sourceActor.get_allocation_box());
        let allocation = Shell.util_get_transformed_allocation(this.sourceActor);
        let monitor = Main.layoutManager.findMonitorForActor(this.sourceActor)
        let [x, y] = [allocation.x1 + contentbox.x1,
                      allocation.y1 + contentbox.y1];
        let [cx, cy] = [allocation.x1 + (contentbox.x1 + contentbox.x2) / 2,
                        allocation.y1 + (contentbox.y1 + contentbox.y2) / 2];
        let [xm, ym] = [allocation.x1 + contentbox.x2,
                        allocation.y1 + contentbox.y2];
        let [width, height] = this.actor.get_size();
        let tipx = cx - width / 2;
        tipx = Math.max(tipx, monitor.x);
        tipx = Math.min(tipx, monitor.x + monitor.width - width);
        let tipy = Math.floor(ym);
        this.actor.set_position(tipx, tipy);
    },
    open: function(animate) {
        if (this.isOpen)
            return;

        this.isOpen = true;
        this.actor.show();
        this._shift();
        this.actor.raise_top();
        this.emit('open-state-changed', true);
    },
    close: function(animate) {
        this.isOpen = false;
        this.actor.hide();
        this.emit('open-state-changed', false);
    }
});
