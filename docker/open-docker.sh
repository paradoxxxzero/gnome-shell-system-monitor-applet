#!/bin/bash
# Connects to the runner Docker container via VNC for manual inspection.
# Requires running ./run-docker.sh first.
xtightvncviewer localhost:5901
