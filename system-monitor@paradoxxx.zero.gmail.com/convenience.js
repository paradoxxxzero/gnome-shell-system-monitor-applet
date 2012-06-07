const Gettext = imports.gettext;
const Gio = imports.gi.Gio;

function initTranslations(metadata) {
    let localeDir = metadata.dir.get_child('locale').get_path();
    Gettext.bindtextdomain('gnome-shell-extensions', localeDir);
}

function getSettings(metadata, extension_id) {
    let schemaDir = metadata.dir.get_child('schemas').get_path();
    let schemaSource = Gio.SettingsSchemaSource.new_from_directory(schemaDir,
								  Gio.SettingsSchemaSource.get_default(),
								  false);
    let schema = schemaSource.lookup('org.gnome.shell.extensions.' + extension_id, false);
    return new Gio.Settings({ settings_schema: schema });
}
								  
