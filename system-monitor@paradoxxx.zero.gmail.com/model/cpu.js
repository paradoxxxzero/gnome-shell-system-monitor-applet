

/* Check if one graph per core must be displayed and create the
   appropriate number of cpu items */
function createCpus()
{
    let array = new Array();
    let numcores = 1;

    if (Schema.get_boolean("cpu-individual-cores")) {
        // get number of cores
        let gtop = new GTop.glibtop_cpu();
        try {
            numcores = GTop.glibtop_get_sysinfo().ncpu;
        } catch(e) {
            global.logError(e);
            numcores = 1;
        }
    }

    // there are several cores to display,
    // instantiate each cpu
    if (numcores > 1) {
        for (let i = 0; i < numcores; i++)
            array.push(new Cpu(i));
    }
    // individual cores option is not set or we failed to
    // get the number of cores, create a global cpu item
    else {
        array.push(new Cpu(-1));
    }

    return array;
}

const Cpu = new Lang.Class({
    Name: 'SystemMonitor.Cpu',
    Extends: ElementBase,

    elt: 'cpu',
    item_name: _("CPU"),
    color_name: ['user', 'system', 'nice', 'iowait', 'other'],
    max: 100,
    cpuid: -1, // cpuid is -1 when all cores are displayed in the same graph

    _init: function(cpuid) {
        this.cpuid = cpuid;
        this.gtop = new GTop.glibtop_cpu();
        this.last = [0,0,0,0,0];
        this.current = [0,0,0,0,0];
        try {
            this.total_cores = GTop.glibtop_get_sysinfo().ncpu;
            if (cpuid == -1)
                this.max *= this.total_cores;
        } catch(e) {
            this.total_cores = this.get_cores();
            global.logError(e)
        }
        this.last_total = 0;
        this.usage = [0,0,0,1,0];
        let item_name = _("Cpu");
        if (cpuid != -1)
            item_name += " " + (cpuid + 1); // append cpu number to cpu name in popup
        //ElementBase.prototype._init.call(this);
        this.parent()
        this.tip_format();
        this.update();
    },
    refresh: function() {
        GTop.glibtop_get_cpu(this.gtop);
        // display global cpu usage on 1 graph
        if (this.cpuid == -1) {
            this.current[0] = this.gtop.user;
            this.current[1] = this.gtop.sys;
            this.current[2] = this.gtop.nice;
            this.current[3] = this.gtop.idle;
            this.current[4] = this.gtop.iowait;
            let delta = (this.gtop.total - this.last_total)/(100*this.total_cores);

            if (delta > 0){
                for (let i = 0;i < 5;i++){
                    this.usage[i] = Math.round((this.current[i] - this.last[i])/delta);
                    this.last[i] = this.current[i];
                }
                this.last_total = this.gtop.total;
            } else if (delta < 0) {
                this.last = [0,0,0,0,0];
                this.current = [0,0,0,0,0];
                this.last_total = 0;
                this.usage = [0,0,0,1,0];
            }
        }
        // display per cpu data
        else {
            this.current[0] = this.gtop.xcpu_user[this.cpuid];
            this.current[1] = this.gtop.xcpu_sys[this.cpuid];
            this.current[2] = this.gtop.xcpu_nice[this.cpuid];
            this.current[3] = this.gtop.xcpu_idle[this.cpuid];
            this.current[4] = this.gtop.xcpu_iowait[this.cpuid];
            let delta = (this.gtop.xcpu_total[this.cpuid] - this.last_total)/100;

            if (delta > 0){
                for (let i = 0;i < 5;i++){
                    this.usage[i] = Math.round((this.current[i] - this.last[i])/delta);
                    this.last[i] = this.current[i];
                }
                this.last_total = this.gtop.xcpu_total[this.cpuid];
            } else if (delta < 0) {
                this.last = [0,0,0,0,0];
                this.current = [0,0,0,0,0];
                this.last_total = 0;
                this.usage = [0,0,0,1,0];
            }

        }

        /*
        GTop.glibtop_get_cpu(this.gtop);
        // display global cpu usage on 1 graph
        if (this.cpuid == -1)
        {
            this.current[0] = this.gtop.user;
            this.current[1] = this.gtop.sys;
            this.current[2] = this.gtop.nice;
            this.current[3] = this.gtop.idle;
            this.current[4] = this.gtop.iowait;
        }
        // display cpu usage for given core
        else
        {
            this.current[0] = this.gtop.xcpu_user[this.cpuid];
            this.current[1] = this.gtop.xcpu_sys[this.cpuid];
            this.current[2] = this.gtop.xcpu_nice[this.cpuid];
            this.current[3] = this.gtop.xcpu_idle[this.cpuid];
            this.current[4] = this.gtop.xcpu_iowait[this.cpuid];
        }

        let delta = 0;
        if (this.cpuid == -1)
            delta = (this.gtop.total - this.last_total)/(100*this.total_cores);
        else
            delta = (this.gtop.xcpu_total[this.cpuid] - this.last_total)/100;

        if (delta > 0){
            for (let i = 0;i < 5;i++){
                this.usage[i] = Math.round((this.current[i] - this.last[i])/delta);
                this.last[i] = this.current[i];
            }
            if (this.cpuid == -1)
                this.last_total = this.gtop.total;
            else
                this.last_total = this.gtop.xcpu_total[this.cpuid];
        }
        */
    },
    _apply: function() {
        let percent = 0;
        if (this.cpuid == -1)
            percent = Math.round(((100 * this.total_cores) - this.usage[3])
                                 / this.total_cores);
        else
            percent = Math.round((100 - this.usage[3]));

        this.text_items[0].text = this.menu_items[3].text = percent.toString();
        let other = 100;
        for (let i = 0;i < this.usage.length;i++)
            other -= this.usage[i];
        //Not to be confusing
        other = Math.max(0, other);
        this.vals = [this.usage[0], this.usage[1],
                     this.usage[2], this.usage[4], other];
        for (let i = 0;i < 5;i++)
            this.tip_vals[i] = Math.round(this.vals[i]);
    },

    get_cores: function(){
        // Getting xcpu_total makes gjs 1.29.18 segfault
        // let cores = 0;
        // GTop.glibtop_get_cpu(this.gtop);
        // let gtop_total = this.gtop.xcpu_total
        // for (let i = 0; i < gtop_total.length;i++){
        //     if (gtop_total[i] > 0)
        //         cores++;
        // }
        // return cores;
        return 1;
    },
    create_text_items: function() {
        return [new St.Label({ style_class: Style.get("sm-status-value")}),
                new St.Label({ text: '%', style_class: Style.get("sm-perc-label")})];

    },
    create_menu_items: function() {
        return [new St.Label(),
                new St.Label(),
                new St.Label(),
                new St.Label({ style_class: Style.get("sm-value")}),
                new St.Label(),
                new St.Label({ text: '%', style_class: Style.get("sm-label")})];
    }
});
