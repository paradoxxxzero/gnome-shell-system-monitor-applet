#!/bin/bash
DEST=$1

for p in */ 
do
   echo $p
   `mkdir -p $1/$p/LC_MESSAGES`
   `msgfmt ./$p/system-monitor-applet.po -o $1/$p/LC_MESSAGES/system-monitor.mo`
done
