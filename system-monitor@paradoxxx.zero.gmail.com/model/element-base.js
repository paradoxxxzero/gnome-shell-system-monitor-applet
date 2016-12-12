(exports => {
    const Lang = imports.lang;
    const Clutter = imports.gi.Clutter;
    const St = imports.gi.St;
    const Mainloop = imports.mainloop;
    const Main = imports.ui.main;

    const _ = imports.gettext.domain('system-monitor').gettext;
    const local = imports.misc.extensionUtils.getCurrentExtension().imports;
    const Schema = local.convenience.getSettings();
    const Compat = local.compat;
    const Style = local.model['sm-style-manager'].singleton;
    const Chart = local.model.chart.constructor;
    const TipItem = local.model['tip-item'].constructor;
    const TipBox = local.model['tip-box'].constructor;
    const common = imports.misc.extensionUtils.getCurrentExtension().common;

    function l_limit(t) {
        return (t > 0) ? t : 1000;
    }
    function change_text() {
        this.label.visible = Schema.get_boolean(this.elt + '-show-text');
    }
    function change_style() {
        let style = Schema.get_string(this.elt + '-style');
        this.text_box.visible = style == 'digit' || style == 'both';
        this.chart.actor.visible = style == 'graph' || style == 'both';
    }
    function change_menu() {
        this.menu_visible = Schema.get_boolean(this.elt + '-show-menu');
        build_menu_info();
    }
    function build_menu_info() {
        let elts = Main.__sm.elts;
        let tray_menu = Main.__sm.tray.menu;

        if (tray_menu._getMenuItems().length && tray_menu._getMenuItems()[0].actor.get_last_child()) {
            tray_menu._getMenuItems()[0].actor.get_last_child().destroy_all_children();
            for (let elt in elts) {
                elts[elt].menu_items = elts[elt].create_menu_items();
            }
        } else {
            return;
        }

        let menu_info_box_table = new St.Widget({
            style: "padding: 10px 0px 10px 0px; spacing-rows: 10px; spacing-columns: 15px;",
            layout_manager: new Clutter.TableLayout()
        });
        let menu_info_box_table_layout = menu_info_box_table.layout_manager;

        // Populate Table
        let row_index = 0;
        for (let elt in elts) {
            if (!elts[elt].menu_visible) {
                continue;
            }

            // Add item name to table
            menu_info_box_table_layout.pack(
                new St.Label({
                    text: elts[elt].item_name,
                    style_class: Style.get("sm-title")}), 0, row_index);

            // Add item data to table
            let col_index = 1;
            for (let item in elts[elt].menu_items) {
                menu_info_box_table_layout.pack(
                    elts[elt].menu_items[item], col_index, row_index);

                col_index++;
            }

            row_index++;
        }
        tray_menu._getMenuItems()[0].actor.get_last_child().add(menu_info_box_table, {expand: true});
    }

    exports.constructor = new Lang.Class({
        Name: 'SystemMonitor.ElementBase',
        Extends: TipBox,
        elt: '',
        item_name: _(""),
        color_name: [],
        text_items: [],
        menu_items: [],
        menu_visible: true,
        _init: function() {
            //            TipBox.prototype._init.apply(this, arguments);
            this.parent(arguments);
            this.vals = [];
            this.tip_labels = [];
            this.tip_vals = [];
            this.tip_unit_labels = [];

            this.colors = [];
            for(let color in this.color_name) {
                let name = this.elt + '-' + this.color_name[color] + '-color';
                let clutterColor = Compat.color_from_string(Schema.get_string(name));
                Schema.connect('changed::' + name, Lang.bind(
                    clutterColor, function (schema, key) {
                        this.clutterColor = Compat.color_from_string(Schema.get_string(key));
                    }));
                Schema.connect('changed::' + name,
                               Lang.bind(this,
                                         function() {
                                             this.chart.actor.queue_repaint();
                                         }));
                this.colors.push(clutterColor);
            }

            this.chart = new Chart(Schema.get_int(this.elt + '-graph-width'), common.iconSize, this);
            Schema.connect('changed::background',
                           Lang.bind(this,
                                     function() {
                                         this.chart.actor.queue_repaint();
                                     }));

            this.actor.visible = Schema.get_boolean(this.elt + "-display");
            Schema.connect(
                'changed::' + this.elt + '-display',
                Lang.bind(this,
                          function(schema, key) {
                              this.actor.visible = Schema.get_boolean(key);
                          }));

            this.interval = l_limit(Schema.get_int(this.elt + "-refresh-time"));
            this.timeout = Mainloop.timeout_add(this.interval,
                                                Lang.bind(this, this.update));
            Schema.connect(
                'changed::' + this.elt + '-refresh-time',
                Lang.bind(this,
                          function(schema, key) {
                              Mainloop.source_remove(this.timeout);
                              this.interval = l_limit(Schema.get_int(key));
                              this.timeout = Mainloop.timeout_add(
                                  this.interval, Lang.bind(this, this.update));
                          }));
            Schema.connect('changed::' + this.elt + '-graph-width',
                           Lang.bind(this.chart, this.chart.resize));

            this.label = new St.Label({ text: this.elt == "memory" ? _("mem") : _(this.elt),
                                        style_class: Style.get("sm-status-label")});
            change_text.call(this);
            Schema.connect('changed::' + this.elt + '-show-text', Lang.bind(this, change_text));

            this.menu_visible = Schema.get_boolean(this.elt + '-show-menu');
            Schema.connect('changed::' + this.elt + '-show-menu', Lang.bind(this, change_menu));

            this.actor.add_actor(this.label);
            this.text_box = new St.BoxLayout();

            this.actor.add_actor(this.text_box);
            this.text_items = this.create_text_items();
            for (let item in this.text_items)
                this.text_box.add_actor(this.text_items[item]);
            this.actor.add_actor(this.chart.actor);
            change_style.call(this);
            Schema.connect('changed::' + this.elt + '-style', Lang.bind(this, change_style));
            this.menu_items = this.create_menu_items();
        },
        tip_format: function(unit='%') {
            if (typeof(unit) == 'string') {
                let all_unit = unit;
                unit = [];
                for (let i = 0;i < this.color_name.length;i++) {
                    unit.push(all_unit);
                }
            }
            for (let i = 0;i < this.color_name.length;i++) {
                let tipline = new TipItem();
                this.tipmenu.addMenuItem(tipline);
                tipline.actor.add(new St.Label({ text: _(this.color_name[i]) }));
                this.tip_labels[i] = new St.Label();
                tipline.actor.add(this.tip_labels[i]);

                this.tip_unit_labels[i] = new St.Label({ text: unit[i] });
                tipline.actor.add(this.tip_unit_labels[i]);
                this.tip_vals[i] = 0;
            }
        },
        update: function() {
            if (!this.menu_visible && !this.actor.visible)
                return false;
            this.refresh();
            this._apply();
            this.chart.update();
            for (let i = 0;i < this.tip_vals.length;i++)
                this.tip_labels[i].text = this.tip_vals[i].toString();
            return true;
        },
        destroy: function() {
            TipBox.prototype.destroy.call(this);
            Mainloop.source_remove(this.timeout);
        }
    });
})(this);
