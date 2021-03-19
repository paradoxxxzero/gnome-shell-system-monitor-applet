#!/bin/bash

package_name=system-monitor
#extension_uuid="$package_name@paradoxxx.zero.gmail.com"
extension_uuid=`grep -oP 'UUID *= *\K([^ ]+)$' ../Makefile`
author_name="Florent Mounier"
author_email=paradoxxx.zero@gmail.com

cd $PWD/../$extension_uuid
xgettext -j -k_ -kN_ --from-code=UTF-8 --package-name=$package_name --msgid-bugs-address=$author_email --copyright-holder="`date +%Y` $author_name" -o ../po/$package_name.pot prefs.js extension.js #schemas/org.gnome.shell.extensions.$package_name.gschema.xml
