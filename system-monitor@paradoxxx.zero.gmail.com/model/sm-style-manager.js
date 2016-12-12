(exports => {
    const Lang = imports.lang;

    const _ = imports.gettext.domain('system-monitor').gettext;
    const local = imports.misc.extensionUtils.getCurrentExtension().imports;
    const Schema = local.convenience.getSettings();

    const StyleManager = new Lang.Class({
        Name: 'SystemMonitor.smStyleManager',
        _extension: '',
        _iconsize: 1,
        _diskunits: _('MiB/s'),
        _netunits_kbytes: _('KiB/s'),
        _netunits_mbytes: _('MiB/s'),
        _netunits_kbits : 'kbps',
        _netunits_mbits : 'Mbps',
        _pie_width : 300,
        _pie_height: 300,
        _pie_fontsize: 14,
        _bar_width : 300,
        _bar_height: 150,
        _bar_fontsize: 14,

        _init: function() {
            this._compact = Schema.get_boolean('compact-display');
            if (this._compact) {
                this._extension = '-compact';
                this._iconsize = 3/5;
                this._diskunits = _('MB');
                this._netunits_kbytes = _('kB');
                this._netunits_mbytes = _('MB');
                this._netunits_kbits = 'kb';
                this._netunits_mbits = 'Mb';
                this._pie_width  *= 4/5;
                this._pie_height *= 4/5;
                this._pie_fontsize = 12;
                this._bar_width  *= 3/5;
                this._bar_height *= 3/5;
                this._bar_fontsize = 12;
            }
        },
        get: function(style) {
            return style + this._extension;
        },
        iconsize: function() {
            return this._iconsize;
        },
        diskunits: function() {
            return this._diskunits;
        },
        netunits_kbytes: function() {
            return this._netunits_kbytes;
        },
        netunits_mbytes: function() {
            return this._netunits_mbytes;
        },
        netunits_kbits: function() {
            return this._netunits_kbits;
        },
        netunits_mbits: function() {
            return this._netunits_mbits;
        },
        pie_width: function() {
            return this._pie_width;
        },
        pie_height: function() {
            return this._pie_height;
        },
        pie_fontsize: function() {
            return this._pie_fontsize;
        },
        bar_width: function() {
            return this._bar_width;
        },
        bar_height: function() {
            return this._bar_height;
        },
        bar_fontsize: function() {
            return this._bar_fontsize;
        },
    });

    exports.singleton = new StyleManager();
})(this);
