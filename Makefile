# Basic Makefile

UUID = system-monitor@paradoxxx.zero.gmail.com
BASE_MODULES = $(UUID)/extension.js $(UUID)/README* $(UUID)/metadata.json $(UUID)/prefs.js $(UUID)/stylesheet.css $(UUID)/convenience.js $(UUID)/compat.js $(UUID)/gpu_usage.sh
ifeq ($(strip $(DESTDIR)),)
	INSTALLBASE = $(HOME)/.local/share/gnome-shell/extensions
else
	INSTALLBASE = $(DESTDIR)/usr/share/gnome-shell/extensions
endif
INSTALLNAME = system-monitor@paradoxxx.zero.gmail.com

# The command line passed variable VERSION is used to set the version string
# in the metadata and in the generated zip-file. If no VERSION is passed, the
# current commit SHA1 is used as version number in the metadata while the
# generated zip file has no string attached.
ifdef VERSION
	VSTRING = _v$(VERSION)
else
	VERSION = $(shell git rev-parse HEAD)
	VSTRING =
endif

all: extension

clean:
	rm -f ./$(UUID)/schemas/gschemas.compiled

extension: ./$(UUID)/schemas/gschemas.compiled

./$(UUID)/schemas/gschemas.compiled: ./$(UUID)/schemas/org.gnome.shell.extensions.system-monitor.gschema.xml
	glib-compile-schemas ./$(UUID)/schemas/

install: install-local

install-local: _build
	rm -rf $(INSTALLBASE)/$(INSTALLNAME)
	mkdir -p $(INSTALLBASE)/$(INSTALLNAME)
	cp -r ./_build/* $(INSTALLBASE)/$(INSTALLNAME)/
	-rm -fR _build
	echo done

reload:
	gnome-shell-extension-tool -r $(UUID)

zip-file: _build
	cd _build ; \
	zip -qr "$(UUID)$(VSTRING).zip" .
	mv _build/$(UUID)$(VSTRING).zip ./
	-rm -fR _build

_build: update-translation
	-rm -fR ./_build
	mkdir -p _build
	cp $(BASE_MODULES) _build
	mkdir -p _build/locale
	cp -r $(UUID)/locale/* _build/locale/
	mkdir -p _build/schemas
	cp $(UUID)/schemas/*.xml _build/schemas/
	cp $(UUID)/schemas/gschemas.compiled _build/schemas/
	sed -i 's/"version": -1/"version": "$(VERSION)"/'  _build/metadata.json;

update-translation: all
	cd po; \
	./compile.sh ../system-monitor@paradoxxx.zero.gmail.com/locale;
