#!/bin/sh

gsettings set org.gnome.desktop.background picture-uri file:///usr/share/backgrounds/gnome/Mirror.jpg
gsettings set org.gnome.desktop.background primary-color '#ffffff'
gsettings set org.gnome.desktop.screensaver picture-uri file:///usr/share/backgrounds/gnome/Mirror.jpg
gsettings set org.gnome.desktop.screensaver primary-color '#ffffff'

/usr/local/etc/gnome-keybindings.pl -e /tmp/keys.csv
sed -i 's/<Super>/<Meta>/g' /tmp/keys.csv
/usr/local/etc/gnome-keybindings.pl -i /tmp/keys.csv