(exports => {
    const Gio = imports.gi.Gio;
    const Lang = imports.lang;

    // Class to deal with volumes insertion / ejection
    const MountsMonitor = new Lang.Class({
        Name: 'SystemMonitor.smMountsMonitor',
        files: [],
        num_mounts: -1,
        listeners: [],
        connected: false,
        _init: function() {
            this._volumeMonitor = Gio.VolumeMonitor.get();
            let sys_mounts = ['/home','/tmp','/boot','/usr','/usr/local'];
            this.base_mounts = ['/'];
            sys_mounts.forEach(Lang.bind(this,function(sMount){
                if (this.is_sys_mount(sMount+'/'))
                    this.base_mounts.push(sMount);
            }));
            this.connect();
        },
        refresh: function() {
            // try check that number of volumes has changed
            /*try {
                let num_mounts = this.manager.getMounts().length;
                if (num_mounts == this.num_mounts)
                    return;
                this.num_mounts = num_mounts;
            } catch (e) {};*/

            // Can't get mountlist:
            // GTop.glibtop_get_mountlist
            // Error: No symbol 'glibtop_get_mountlist' in namespace 'GTop'
            // Getting it with mtab
            /*let mount_lines = Shell.get_file_contents_utf8_sync('/etc/mtab').split("\n");
            this.mounts = [];
            for(let mount_line in mount_lines) {
                let mount = mount_lines[mount_line].split(" ");
                if(interesting_mountpoint(mount) && this.mounts.indexOf(mount[1]) < 0) {
                    this.mounts.push(mount[1]);
                }
            }
            log("old mounts: " + this.mounts);*/
            this.mounts = [];
            for (let base in this.base_mounts){
                //log(this.base_mounts[base]);
                this.mounts.push(this.base_mounts[base]);
            }
            let mount_lines = this._volumeMonitor.get_mounts();
            mount_lines.forEach(Lang.bind(this, function(mount) {
                if (!this.is_ro_mount(mount) && !this.is_net_mount(mount)) {
                    let mpath = mount.get_root().get_path() || mount.get_default_location().get_path();
                    if (mpath)
                        this.mounts.push(mpath);
                }
            }));
            //log("base: " + this.base_mounts);
            //log("mounts: " + this.mounts);
            for (let i in this.listeners){
                this.listeners[i](this.mounts);
            }
        },
        add_listener: function(cb) {
            this.listeners.push(cb);
        },
        remove_listener: function(cb) {
            this.listeners.pop(cb);
        },
        get_mounts: function() {
            return this.mounts;
        },
        is_sys_mount: function(mpath) {
            let file = Gio.file_new_for_path(mpath);
            let info = file.query_info(Gio.FILE_ATTRIBUTE_UNIX_IS_MOUNTPOINT,
                                     Gio.FileQueryInfoFlags.NONE, null);
            return info.get_attribute_boolean(Gio.FILE_ATTRIBUTE_UNIX_IS_MOUNTPOINT);
        },
        is_ro_mount: function(mount) {
            try {
                let file = mount.get_default_location();
                let info = file.query_filesystem_info(Gio.FILE_ATTRIBUTE_FILESYSTEM_READONLY, null);
                return info.get_attribute_boolean(Gio.FILE_ATTRIBUTE_FILESYSTEM_READONLY);
            } catch(e) {
                return false;
            }
        },
        is_net_mount: function(mount) {
            try {
                let file = mount.get_default_location();
                let info = file.query_filesystem_info(Gio.FILE_ATTRIBUTE_FILESYSTEM_TYPE, null);
                let result = info.get_attribute_string(Gio.FILE_ATTRIBUTE_FILESYSTEM_TYPE);
                let net_fs = ['nfs', 'smbfs', 'cifs', 'ftp', 'sshfs', 'sftp', 'mtp', 'mtpfs'];
                return !file.is_native() || net_fs.indexOf(result) > -1;
            } catch(e) {
                return false;
            }
        },
        connect: function() {
            if (this.connected)
                return;
            try {
                this.manager = this._volumeMonitor;
                this.mount_added_id = this.manager.connect('mount-added', Lang.bind(this, this.refresh));
                this.mount_removed_id = this.manager.connect('mount-removed', Lang.bind(this, this.refresh));
                //need to add the other signals here
                this.connected = true;
            }
            catch (e) {
                log('Failed to register on placesManager notifications');
                log('Got exception : ' + e);
            }
            this.refresh();
        },
        disconnect: function() {
            if (!this.connected)
                return;
            this.manager.disconnect(this.mount_added_id);
            this.manager.disconnect(this.mount_removed_id);
            this.connected = false;
        },
        destroy: function() {
            this.disconnect();
        }
    });

    exports.singleton = new MountsMonitor();
})(this);
