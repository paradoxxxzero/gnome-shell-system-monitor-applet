#!/bin/bash
set -e

if [ -z "$USER" ]; then
  USER=$(whoami)
fi

sudo docker build -t $USER/vnc-gnome \
  --build-arg GID=$(id -g $USER) \
  --build-arg UID=$(id -u $USER) \
  --build-arg USER=$USER .
