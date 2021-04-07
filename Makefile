# -*- coding: utf-8; mode: makefile-gmake -*-
# Basic Makefile

UUID = system-monitor@paradoxxx.zero.gmail.com
INSTALLNAME = $(UUID)

BASE_MODULES = \
  $(UUID)/extension.js \
  $(UUID)/README* \
  $(UUID)/metadata.json \
  $(UUID)/prefs.js \
  $(UUID)/stylesheet.css \
  $(UUID)/convenience.js \
  $(UUID)/compat.js \
  $(UUID)/gpu_usage.sh

# ---------
# variables
# ---------

ifeq ($(strip $(DESTDIR)),)
  INSTALLBASE = $(HOME)/.local/share/gnome-shell/extensions
  SUDO=
else
  INSTALLBASE = $(DESTDIR)/usr/share/gnome-shell/extensions
ifeq ($(BUILD_FOR_RPM),1)
  SUDO=
else
  SUDO=sudo
endif
endif

ifdef VERSION
  VSTRING = _v$(VERSION)
else
  VERSION = $(shell git rev-parse HEAD)
  VSTRING =
endif

# VERBOSE level

ifeq ($(V),1)
  Q =
  VV = -v
else
  Q = @
  VV =
endif

# -------
# macros
# -------

# usage: $(call reload-extension $(UUID))

reload-extension = $(shell gnome-shell-extension-tool -r $(1))

# usage: $(call msg,INFO,'lorem ipsum')
msg = @printf '  [%-12s] %s\n' '$(1)' '$(2)'


# -------
# targets
# -------

# is there anymore use of the (old) 'all' target?
# PHONY += all
# all: extension

PHONY += help
help:
	@echo  'Install or remove (and reload) of the extension, for the local user'
	@echo  'or as admin for all users:'
	@echo  ''
	@echo  '  make [install|remove]                        # for the local user'
	@echo  '  make DESTDIR=/ [install|remove] clean        # as admin for all users'
	@echo  ''
	@echo  'Use environment VERSION=n.m to set verison string in the metadata and in'
	@echo  'the generated zip-file explicit.  If no VERSION is passed, the current'
	@echo  'commit SHA1 is used as version number in the metadata while the generated'
	@echo  'zip file has no string attached.'
	@echo  ''
	@echo  'Other targets are:'
	@echo  ''
	@echo  '  zip-file  - build and zip ./$(UUID).zip'
	@echo  '  reload    - reload extension $(UUID)'
	@echo  '  clean     - remove most generated files'
	@echo  '  extension - rebuild schemas/gschemas.compiled'
	@echo  '  translate - generate translation from po/ files'
	@echo  ''
	@echo  'control verbosity:'
	@echo  ''
	@echo  '  make V=0 [targets] -> quiet build (default)'
	@echo  '  make V=1 [targets] -> verbose build'


PHONY += install remove

install: remove build
	$(call msg,$@,$(SUDO) $(INSTALLBASE)/$(INSTALLNAME))
	$(Q) $(SUDO) mkdir -p $(INSTALLBASE)/$(INSTALLNAME)
	$(Q) $(SUDO) cp $(VV) -r ./_build/* $(INSTALLBASE)/$(INSTALLNAME)/
ifeq ($(strip $(BUILD_FOR_RPM)),)
	$(Q) $(MAKE) -s reload
endif
	$(call msg,$@,OK)

remove:
	$(call msg,$@,$(SUDO) $(INSTALLBASE)/$(INSTALLNAME))
	$(Q) $(SUDO) rm $(VV) -fr $(INSTALLBASE)/$(INSTALLNAME)
ifeq ($(strip $(BUILD_FOR_RPM)),)
	$(Q) $(MAKE) -s reload
endif
	$(call msg,$@,OK)

reload:
	$(call reload-extension,$(UUID))
	$(call msg,$@,OK)


PHONY += zip-file zip-file.clean
ZIPFILE=$(UUID)$(VSTRING).zip

zip-file: build.clean build
	$(Q)cd _build ; zip $(V) -qr $(ZIPFILE) .
	$(Q)mv _build/$(ZIPFILE) ./dist/$(ZIPFILE)
	$(call msg,$@,OK)

clean:: zip-file.clean
zip-file.clean:
	$(Q)rm $(VV) -f $(ZIPFILE)
	$(call msg,$@,OK)


PHONY += extension extension.clean _drop-gschemas

extension: _drop-gschemas ./$(UUID)/schemas/gschemas.compiled
	$(call msg,$@,OK)

clean:: extension.clean
extension.clean:
	$(Q)git checkout -f -- ./$(UUID)/schemas/gschemas.compiled
	$(call msg,$@,OK)

./$(UUID)/schemas/gschemas.compiled: ./$(UUID)/schemas/org.gnome.shell.extensions.system-monitor.gschema.xml
	$(Q)glib-compile-schemas ./$(UUID)/schemas/
	$(call msg,gschemas,OK)

_drop-gschemas:
	$(Q)rm -f ./$(UUID)/schemas/gschemas.compiled


PHONY += build build.clean

build: translate
	$(Q)mkdir -p _build
	$(Q)cp $(VV) $(BASE_MODULES) _build
	$(Q)mkdir -p _build/locale
	$(Q)cp $(VV) -r $(UUID)/locale/* _build/locale/
	$(Q)mkdir -p _build/schemas
	$(Q)cp $(VV) $(UUID)/schemas/*.xml _build/schemas/
	$(Q)cp $(VV)  $(UUID)/schemas/gschemas.compiled _build/schemas/
	$(Q)sed -i 's/"version": -1/"version": "$(VERSION)"/'  _build/metadata.json;
	$(call msg,$@,OK)

clean:: build.clean
build.clean:
	$(Q)rm -fR ./_build
	$(call msg,$@,OK)

PHONY += translate
translate: extension
	$(Q)cd po;\
           ./compile.sh ../system-monitor@paradoxxx.zero.gmail.com/locale \
	   | tr '\n' ' ' \
	   | sed -e 's/^/  [$@   ] /;'; echo
	$(call msg,$@,OK)

clean:: translation.clean
translation.clean:
	$(Q)git checkout -f -- system-monitor@paradoxxx.zero.gmail.com/locale

.PHONY: $(PHONY)
