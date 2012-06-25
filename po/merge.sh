#!/bin/bash

for p in */ 
do
   echo $p
   `msgmerge -U ./$p/system-monitor-applet.po system-monitor-applet.pot`
done
