

const ElementBase = new Lang.Class({
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
            let clutterColor = color_from_string(Schema.get_string(name));
            Schema.connect('changed::' + name, Lang.bind(
                clutterColor, function (schema, key) {
                    this.clutterColor = color_from_string(Schema.get_string(key));
                }));
            Schema.connect('changed::' + name,
                           Lang.bind(this,
                                     function() {
                                         this.chart.actor.queue_repaint();
                                     }));
            this.colors.push(clutterColor);
        }

        this.chart = new Chart(Schema.get_int(this.elt + '-graph-width'), IconSize, this);
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
    tip_format: function(unit) {
        typeof(unit) == 'undefined' && (unit = '%');
        if(typeof(unit) == 'string') {
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
    /*        set_tip_unit: function(unit) {
              for (let i = 0;i < this.tip_unit_labels.length;i++) {
              this.tip_unit_labels[i].text = unit[i];
              }
              },*/
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
