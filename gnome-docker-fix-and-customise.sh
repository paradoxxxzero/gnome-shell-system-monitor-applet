#!/bin/sh
# (c) Pete Birley

#Set a nicer background image for the desktop and lock screen (reffred to as sreensaver in the dconf database)
gsettings set org.gnome.desktop.background picture-uri file:///usr/share/backgrounds/gnome/Mirror.jpg
gsettings set org.gnome.desktop.background primary-color '#ffffff'
gsettings set org.gnome.desktop.screensaver picture-uri file:///usr/share/backgrounds/gnome/Mirror.jpg
gsettings set org.gnome.desktop.screensaver primary-color '#ffffff'

#Fix the keybindings under VNC - this is required due to the lack of a 'super key' - which bugs out GNOME
#This is a very dirty hack, it rips the keybindings from the dconf database to a csv, then swaps all mentions #of <Super> with <Meta>, and then sets all the keybindings based on the modified csv.
#It should be replaced with somthing much more elegant.
/usr/local/etc/gnome-keybindings.pl -e /tmp/keys.csv
sed -i 's/<Super>/<Meta>/g' /tmp/keys.csv
/usr/local/etc/gnome-keybindings.pl -i /tmp/keys.csv