(exports => {
    const GLib = imports.gi.GLib;
    const Lang = imports.lang;
    const Shell = imports.gi.Shell;
    const St = imports.gi.St;
    const Panel = imports.ui.panel;

    let GTop, NMClient, NetworkManager;
    try {
        GTop = imports.gi.GTop;
        NMClient = imports.gi.NMClient;
        NetworkManager = imports.gi.NetworkManager;
    }
    catch(e) {/* handled earlier */}

    const _ = imports.gettext.domain('system-monitor').gettext;
    const local = imports.misc.extensionUtils.getCurrentExtension().imports;
    const Schema = local.convenience.getSettings();
    const Style = local.model['sm-style-manager'].singleton;
    const ElementBase = local.model['element-base'].constructor;

    let iconSize = Math.round(Panel.PANEL_ICON_SIZE * 4 / 5);

    exports.constructor = new Lang.Class({
        Name: 'SystemMonitor.Net',
        Extends: ElementBase,

        elt: 'net',
        item_name: _("Net"),
        color_name: ['down', 'downerrors', 'up', 'uperrors', 'collisions'],
        speed_in_bits: false,

        _init: function() {
            this.ifs = [];
            this.client = NMClient.Client.new();
            this.update_iface_list();

            if(!this.ifs.length){
                let net_lines = Shell.get_file_contents_utf8_sync('/proc/net/dev').split("\n");
                for(let i = 2; i < net_lines.length - 1 ; i++) {
                    let ifc = net_lines[i].replace(/^\s+/g, '').split(":")[0];
                    if(Shell.get_file_contents_utf8_sync('/sys/class/net/' + ifc + '/operstate')
                       .replace(/\s/g, "") == "up" &&
                       ifc.indexOf("br") < 0 &&
                       ifc.indexOf("lo") < 0) {
                        this.ifs.push(ifc);
                    }
                }
            }
            this.gtop = new GTop.glibtop_netload();
            this.last = [0, 0, 0, 0, 0];
            this.usage = [0, 0, 0, 0, 0];
            this.last_time = 0;
            this.parent();
            this.tip_format([_('KiB/s'), '/s', _('KiB/s'), '/s', '/s']);
            this.update_units();
            Schema.connect('changed::' + this.elt + '-speed-in-bits', Lang.bind(this, this.update_units));
            try {
                let iface_list = this.client.get_devices();
                this.NMsigID = [];
                for(let j = 0; j < iface_list.length; j++) {
                    this.NMsigID[j] = iface_list[j].connect('state-changed' , Lang.bind(this, this.update_iface_list));
                }
            }
            catch(e) {
                global.logError("Please install Network Manager Gobject Introspection Bindings: " + e);
            }
            this.update();
        },
        update_units: function() {
            this.speed_in_bits = Schema.get_boolean(this.elt + '-speed-in-bits');
        },
        update_iface_list: function() {
            try {
                this.ifs = [];
                let iface_list = this.client.get_devices();
                for(let j = 0; j < iface_list.length; j++){
                    if (iface_list[j].state == NetworkManager.DeviceState.ACTIVATED){
                        this.ifs.push(iface_list[j].get_ip_iface() || iface_list[j].get_iface());
                    }
                }
            }
            catch(e) {
                global.logError("Please install Network Manager Gobject Introspection Bindings");
            }
        },
        refresh: function() {
            let accum = [0, 0, 0, 0, 0];

            for (let ifn in this.ifs) {
                GTop.glibtop_get_netload(this.gtop, this.ifs[ifn]);
                accum[0] += this.gtop.bytes_in;
                accum[1] += this.gtop.errors_in;
                accum[2] += this.gtop.bytes_out;
                accum[3] += this.gtop.errors_out;
                accum[4] += this.gtop.collisions;
            }

            let time = GLib.get_monotonic_time() * 0.001024;
            let delta = time - this.last_time;
            if (delta > 0)
                for (let i = 0;i < 5;i++) {
                    this.usage[i] = Math.round((accum[i] - this.last[i]) / delta);
                    this.last[i] = accum[i];
                    this.vals[i] = this.usage[i];
                }
            this.last_time = time;
        },

        // pad a string with leading 0s
        _pad:function(number, length) {
            var str = '' + number;
            while (str.length < length) {
                str = '0' + str;
            }
            return str;
        },

        _apply: function() {
            this.tip_vals = this.usage;
            if (this.speed_in_bits) {
                this.tip_vals[0] = Math.round(this.tip_vals[0] * 8.192);
                this.tip_vals[2] = Math.round(this.tip_vals[2] * 8.192);
                if (this.tip_vals[0] < 1000) {
                    this.text_items[2].text = Style.netunits_kbits();
                    this.menu_items[1].text = this.tip_unit_labels[0].text = 'kbps';
                }
                else {
                    this.text_items[2].text = Style.netunits_mbits();
                    this.menu_items[1].text = this.tip_unit_labels[0].text = 'Mbps';
                    this.tip_vals[0] = (this.tip_vals[0] / 1000).toPrecision(3);
                }
                if (this.tip_vals[2] < 1000) {
                    this.text_items[5].text = Style.netunits_kbits();
                    this.menu_items[4].text = this.tip_unit_labels[2].text = 'kbps';
                }
                else {
                    this.text_items[5].text = Style.netunits_mbits();
                    this.menu_items[4].text = this.tip_unit_labels[2].text = 'Mbps';
                    this.tip_vals[2] = (this.tip_vals[2] / 1000).toPrecision(3);
                }
            }
            else {
                if (this.tip_vals[0] < 1024) {
                    this.text_items[2].text = Style.netunits_kbytes();
                    this.menu_items[1].text = this.tip_unit_labels[0].text = _('KiB/s');
                }
                else {
                    this.text_items[2].text = Style.netunits_mbytes();
                    this.menu_items[1].text = this.tip_unit_labels[0].text = _('MiB/s');
                    this.tip_vals[0] = (this.tip_vals[0] / 1024).toPrecision(3);
                }
                if (this.tip_vals[2] < 1024) {
                    this.text_items[5].text = Style.netunits_kbytes();
                    this.menu_items[4].text = this.tip_unit_labels[2].text = _('KiB/s');
                }
                else {
                    this.text_items[5].text = Style.netunits_mbytes();
                    this.menu_items[4].text = this.tip_unit_labels[2].text = _('MiB/s');
                    this.tip_vals[2] = (this.tip_vals[2] / 1024).toPrecision(3);
                }
            }

            if (Style.get('') != '-compact') {
                this.menu_items[0].text = this.text_items[1].text = this.tip_vals[0].toString();
                this.menu_items[3].text = this.text_items[4].text = this.tip_vals[2].toString();
            }
            else {
                this.menu_items[0].text = this.text_items[1].text = this._pad(this.tip_vals[0].toString(), 3);
                this.menu_items[3].text = this.text_items[4].text = this._pad(this.tip_vals[2].toString(), 3);
            }

        },
        create_text_items: function() {
            return [new St.Icon({icon_size: 2 * iconSize / 3 * Style.iconsize(),
                                  icon_name:'go-down-symbolic'}),
                    new St.Label({ style_class: Style.get("sm-net-value")}),
                    new St.Label({ text: _('KiB/s'), style_class: Style.get("sm-net-unit-label")}),
                    new St.Icon({ icon_size: 2 * iconSize / 3 * Style.iconsize(),
                                  icon_name:'go-up-symbolic'}),
                    new St.Label({ style_class: Style.get("sm-net-value")}),
                    new St.Label({ text: _('KiB/s'), style_class: Style.get("sm-net-unit-label")})];
        },
        create_menu_items: function() {
            return [new St.Label({ style_class: Style.get("sm-value")}),
                    new St.Label({ text:_('KiB/s'), style_class: Style.get("sm-label")}),
                    new St.Label({ text:_('Down'), style_class: Style.get("sm-label")}),
                    new St.Label({ style_class: Style.get("sm-value")}),
                    new St.Label({ text:_('KiB/s'), style_class: Style.get("sm-label")}),
                    new St.Label({ text:_('Up'), style_class: Style.get("sm-label")})];
        }
    });
})(this);
