#!/bin/bash

for p in */ 
do
   echo $p
   `msgmerge -U ./$p/system-monitor.po system-monitor.pot`
done
