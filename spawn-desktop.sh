#!/bin/sh
# (c) Pete Birley

systemctl start gdm
systemctl enable gdm

#this sets the vnc password
/usr/local/etc/start-vnc-expect-script.sh
#fixes a warning with starting nautilus on firstboot - which we will always be doing.
mkdir -p ~/.config/nautilus
#this starts the vnc server
USER=root vncserver :1 -geometry 1366x768 -depth 24
