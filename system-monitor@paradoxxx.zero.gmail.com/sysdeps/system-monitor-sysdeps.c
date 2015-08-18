#include "system-monitor-sysdeps.h"
#include <glib.h>

#ifdef __FreeBSD__
#include <ifaddrs.h>
#include <net/if.h>
#include <net/if_types.h>
#include <stdbool.h>
#include <stddef.h>
#include <string.h>
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

/**
 * system_monitor_sysdeps_getifaddrs_up_not_loopback_or_bridge:
 *
 * Returns: (element-type utf8) (transfer full)
 */
GSList* system_monitor_sysdeps_getifaddrs_up_not_loopback_or_bridge (void) {
    struct ifaddrs *ifap;
    if (getifaddrs (&ifap) == -1) {
        return NULL;
    }
    if (ifap == NULL) {
        return NULL;
    }

    GSList *ifs = NULL;
    const char *name = ifap->ifa_name;
    bool is_up = true, is_loopback = false, is_bridge = false;
    for (struct ifaddrs *ifa = ifap; ifa != NULL; ifa = ifa->ifa_next) {
        if (strcmp (ifa->ifa_name, name) != 0) {
            if (is_up && !is_loopback && !is_bridge) {
                ifs = g_slist_prepend (ifs, g_strdup (name));
            }
            is_up = true, is_loopback = false, is_bridge = false;
        }
        name = ifa->ifa_name;
        is_up = is_up && (ifa->ifa_flags & IFF_UP);
        is_loopback = is_loopback || (ifa->ifa_flags & IFF_LOOPBACK);
        if (ifa->ifa_addr->sa_family == AF_LINK) {
            struct if_data *ifd = ifa->ifa_data;
            is_bridge = is_bridge || (ifd->ifi_type == IFT_BRIDGE);
        }
        if (ifa->ifa_next == NULL) {
            if (is_up && !is_loopback && !is_bridge) {
                ifs = g_slist_prepend (ifs, g_strdup (name));
            }
        }
    }

    freeifaddrs (ifap);
    return ifs;
}
#endif
