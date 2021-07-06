#!/bin/bash
# Build the docker image.

SCRIPT_DIR="$(dirname "$(readlink -f ${BASH_SOURCE[0]})")"
cd $SCRIPT_DIR

cd ..
docker build -t gnome-shell-system-monitor-applet -f ./docker/Dockerfile.ubuntu2004 .
