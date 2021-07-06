#!/bin/bash
# Kills any running Docker container.
containers=`docker ps | grep "gnome-shell-system-monitor-applet" | awk '{ print $1 }'`
if [ ! -z "$containers" ]
then
    docker rm --force $containers
fi
