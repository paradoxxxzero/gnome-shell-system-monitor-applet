#include "system-monitor-sysdeps.h"

#ifdef __FreeBSD__
#include <stdbool.h>
#include <stddef.h>
#include <sys/types.h>
#include <sys/sysctl.h>

#define MIB_LEN 4
int system_monitor_sysdeps_sysctl_dev_cpu_0_freq (void) {
    static bool init;
    static int mib[MIB_LEN];

    if (!init) {
        if (sysctlnametomib ("dev.cpu.0.freq", mib, &(size_t){ MIB_LEN }) == -1) {
            return -1;
        }
        init = true;
    }

    int freq;
    if (sysctl (mib, MIB_LEN, &freq, &(size_t){ sizeof (freq) }, NULL, 0) == -1) {
        return -1;
    }
    return freq;
}
#undef MIB_LEN

#endif
