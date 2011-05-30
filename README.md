## Gnome shell system monitor extension

### Install:
#### On archlinux:

I've created a package in aur: https://aur.archlinux.org/packages.php?ID=49250

You can install it with: yaourt or packer -S gnome-shell-system-monitor-applet-git

#### Everywhere else for now:

Install git if you don't have it: (sudo apt-get install git-core, sudo pacman -S git, etc)
Then:

    mkdir ~/git_projects
    cd ~/git_projects
    git clone git://github.com/paradoxxxzero/gnome-shell-system-monitor-applet.git
    mkdir -p ~/.local/share/gnome-shell/extensions
    cd ~/.local/share/gnome-shell/extensions
    ln -s ~/git_projects/gnome-shell-system-monitor-applet/system-monitor@paradoxxx.zero.gmail.com

Then install the schema:

    sudo mkdir -p /usr/local/share/glib-2.0/schemas
    sudo cp ~/git_projects/gnome-shell-system-monitor-applet/org.gnome.shell.extensions.system-monitor.gschema.xml /usr/local/share/glib-2.0/schemas
    cd /usr/local/share/glib-2.0/schemas
    sudo glib-compile-schemas . # Don't forget the dot!

And restart gnome-shell (Alt + F2 -> r) or reboot.


### License:

Copyright (C) 2011 Florian Mounier aka paradoxxxzero

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

