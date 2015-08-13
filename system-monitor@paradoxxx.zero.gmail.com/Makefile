.PHONY: all clean distclean

# Commands
INTROSPECTION_SCANNER = g-ir-scanner
INTROSPECTION_COMPILER = g-ir-compiler

# Arguments
SMSYSDEPS_CFLAGS = -fPIC -shared -Wall -O2

# Sources
CFILES = sysdeps/system-monitor-sysdeps.c
HFILES = sysdeps/system-monitor-sysdeps.h

# Compiled shared object
SOLIB  = system-monitor-sysdeps
SOFILE = sysdeps/lib$(SOLIB).so

# Compiled gir and typelib file
NAMESPACE = SystemMonitorSysdeps
NSVERSION = 0.1
SMPREFIX = system_monitor_sysdeps
GIRFILE = sysdeps/$(NAMESPACE)-$(NSVERSION).gir
TYPELIBFILE = $(GIRFILE:.gir=.typelib)

all: $(TYPELIBFILE)
distclean: clean

$(SOFILE): $(CFILES) $(HFILES)
	$(CC) $(SMSYSDEPS_CFLAGS) $(CFLAGS) $(CFILES) -o $(SOFILE) $(LDFLAGS)
$(GIRFILE): $(SOFILE)
	LD_LIBRARY_PATH=./sysdeps:${LD_LIBRARY_PATH} $(INTROSPECTION_SCANNER) \
		$(CFILES) $(HFILES) \
		-Lsysdeps \
		--library=$(SOLIB) \
		--namespace=$(NAMESPACE) \
		--nsversion=$(NSVERSION) \
		--symbol-prefix=$(SMPREFIX) \
		--output=$(GIRFILE)
$(TYPELIBFILE): $(GIRFILE)
	$(INTROSPECTION_COMPILER) $(GIRFILE) -o $(TYPELIBFILE)

clean:
	rm -f $(SOFILE) $(GIRFILE) $(TYPELIBFILE)
