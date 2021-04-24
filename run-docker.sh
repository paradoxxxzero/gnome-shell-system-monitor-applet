#!/bin/bash
docker run -it --name=ubuntu-gnome --rm \
    --tmpfs /run --tmpfs /run/lock --tmpfs /tmp \
    --cap-add SYS_BOOT --cap-add SYS_ADMIN \
    -v /sys/fs/cgroup:/sys/fs/cgroup \
    -v "$(pwd)/testing:/home/default/shared" \
    -p 5901:5901 -p 6901:6901 \
    gnome-shell-system-monitor-applet
