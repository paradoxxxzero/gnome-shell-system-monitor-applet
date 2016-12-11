(exports => {
    const Clutter = imports.gi.Clutter;
    const Lang = imports.lang;
    const St = imports.gi.St;
    const ModalDialog = imports.ui.modalDialog;

    const _ = imports.gettext.domain('system-monitor').gettext;
    const MESSAGE = _("Dependencies Missing\n" +
        "Please install: \n" +
        "libgtop, Network Manager and gir bindings \n" +
        "\t    on Ubuntu: gir1.2-gtop-2.0, gir1.2-networkmanager-1.0 \n" +
        "\t    on Fedora: libgtop2-devel, NetworkManager-glib-devel \n" +
        "\t    on Arch: libgtop, networkmanager\n" +
        "\t    on openSUSE: typelib-1_0-GTop-2_0, typelib-1_0-NetworkManager-1_0\n");

    exports.constructor = Lang.Class({
        Name: 'SystemMonitor.smDialog',
        Extends: ModalDialog.ModalDialog,

        _init : function() {
            this.parent({ styleClass: 'prompt-dialog' });
            let mainContentBox = new St.BoxLayout({ style_class: 'prompt-dialog-main-layout',
                                                    vertical: false });
            this.contentLayout.add(mainContentBox,
                                   { x_fill: true,
                                     y_fill: true });

            let messageBox = new St.BoxLayout({ style_class: 'prompt-dialog-message-layout',
                                                vertical: true });
            mainContentBox.add(messageBox,
                               { y_align: St.Align.START });

            this._subjectLabel = new St.Label({ style_class: 'prompt-dialog-headline',
                                                text: _("System Monitor Extension") });

            messageBox.add(this._subjectLabel,
                           { y_fill:  false,
                             y_align: St.Align.START });

            this._descriptionLabel = new St.Label({ style_class: 'prompt-dialog-description',
                                                    text: MESSAGE });

            messageBox.add(this._descriptionLabel,
                           { y_fill:  true,
                             y_align: St.Align.START });


            this.setButtons([
                {
                    label: _("Cancel"),
                    action: Lang.bind(this, function() {
                        this.close();
                    }),
                    key: Clutter.Escape
                }
            ]);
        },
    });
})(this);
