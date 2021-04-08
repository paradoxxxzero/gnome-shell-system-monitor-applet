#!/bin/bash
# Build the docker image.
docker build -t gnome-shell-system-monitor-applet -f Dockerfile.ubuntu2004 .
