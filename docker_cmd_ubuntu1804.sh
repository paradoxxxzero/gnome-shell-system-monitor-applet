#!/bin/bash
# Called from the Dockerfile.* to execute our tests via the CMD.
set -e

echo "[$(date)] Launching Dbus."
mkdir -p /var/run/dbus
dbus-daemon --config-file=/usr/share/dbus-1/system.conf --print-address
sleep 3 # give Dbus some time to start

echo "[$(date)] Launching Xvfb."
export DISPLAY=:99.0
/sbin/start-stop-daemon --start --quiet --pidfile /tmp/custom_xvfb_99.pid --make-pidfile --background --exec /usr/bin/Xvfb -- :99 -ac -screen 0 1280x1024x16
sleep 3 # give xvfb some time to start

echo "[$(date)] Launching Gnome-Shell."
sudo gnome-shell &
sleep 3 # give gnome-shell some time to start
echo "[$(date)] Confirming Gnome-Shell is running."
pgrep gnome-shell

echo "[$(date)] Showing Gnome-Shell log entries."
sudo journalctl /usr/bin/gnome-shell || true
echo "[$(date)] Rotating Gnome-Shell log entries."
sudo journalctl --rotate || true
echo "[$(date)] Clearing Gnome-Shell log entries."
sudo journalctl --vacuum-time=1s || true

echo "[$(date)] Show pre-extension Gnome-Shell performance."
ps -C gnome-shell -o %cpu,%mem,cmd || true

echo "[$(date)] Running JSLint check."
#cd $TRAVIS_BUILD_DIR
./checkjs.sh

echo "[$(date)] Installing extension."
sudo make install
gnome-shell-extension-tool --enable-extension=system-monitor@paradoxxx.zero.gmail.com
sleep 10 # Give extension time to run.

echo "[$(date)] Showing post-extension Gnome-Shell performance."
export MAX_CPU_PERCENT=20
export MAX_MEM_PERCENT=5
ps -C gnome-shell -o %cpu,%mem,cmd
# Check CPU. On localhost with 2.80GHz x 4 takes ~3%, on Travis ~15%.
bash -c '[[ $(bc <<< "$(ps -C gnome-shell -o %cpu|tail -1) < $MAX_CPU_PERCENT") -eq 1 ]]'
# Check memory. On localhost with 32GB of memory, ~0.6%, on Travis ~3%.
bash -c '[[ $(bc <<< "$(ps -C gnome-shell -o %mem|tail -1) < $MAX_MEM_PERCENT") -eq 1 ]]'

echo "[$(date)] Confirming extension hasn't thrown any errors."
# Note, finding no entries returns an error code of 1, which in our case means no error.
sudo journalctl /usr/bin/gnome-shell
sudo journalctl /usr/bin/gnome-shell|grep "\-\- No entries \-\-"
sudo journalctl --since=$(date '+%Y-%m-%d') /usr/bin/gnome-shell|grep -i "Extension \"system-monitor@paradoxxx.zero.gmail.com\" had error"
