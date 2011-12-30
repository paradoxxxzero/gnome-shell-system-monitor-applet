#!/bin/bash
DEST=$1

for p in */ 
do
   echo $p
   `mkdir -p $1/$p/LC_MESSAGE`
   `msgfmt ./$p/system-monitor-applet.po -o $1/$p/LC_MESSAGE/system-monitor-applet.mo`
done
