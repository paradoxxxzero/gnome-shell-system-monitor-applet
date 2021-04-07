#!/bin/bash
set -e

docker build -t gnome-shell-system-monitor-applet -f Dockerfile.ubuntu2004 .
