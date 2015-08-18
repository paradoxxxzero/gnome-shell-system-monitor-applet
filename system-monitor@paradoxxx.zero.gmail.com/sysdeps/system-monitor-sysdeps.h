#include <glib.h>
#ifdef __FreeBSD__
int         system_monitor_sysdeps_sysctl_dev_cpu_0_freq (void);
GSList*     system_monitor_sysdeps_getifaddrs_up_not_loopback_or_bridge (void);
#endif
