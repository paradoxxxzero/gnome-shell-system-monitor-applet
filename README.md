## Gnome shell system monitor extension
![](http://i.imgur.com/ka9OA.png)

![](http://i.imgur.com/mmRTu.png)

![](http://i.imgur.com/wDfAF.png)


### Install:
#### Archlinux:

[AUR package](https://aur.archlinux.org/packages.php?ID=49250)
You can install it with: yaourt or packer -S gnome-shell-system-monitor-applet-git
[See also](https://wiki.archlinux.org/index.php/GNOME#Show_system_monitor)

#### Ubuntu:

[See here for the Webupd8 ppa](http://www.webupd8.org/2011/10/gnome-shell-system-monitor-extension.html)

#### Everywhere else for now:

Dependencies:
    
    python3
    python3-gobject
    libgtop and gir bindings (gir1.2-gtop-2.0, gir1.2-networkmanager-1.0 on Ubuntu)

Install git if you don't have it: (sudo apt-get install git-core, sudo pacman -S git, etc)
Then:

    mkdir ~/git_projects
    cd ~/git_projects
    git clone git://github.com/paradoxxxzero/gnome-shell-system-monitor-applet.git
    mkdir -p ~/.local/share/gnome-shell/extensions
    cd ~/.local/share/gnome-shell/extensions
    ln -s ~/git_projects/gnome-shell-system-monitor-applet/system-monitor@paradoxxx.zero.gmail.com
    cp ~/git_projects/gnome-shell-system-monitor-applet/system-monitor-applet-config.desktop ~/.local/share/applications/

Then install the schema:

    sudo mkdir -p /usr/local/share/glib-2.0/schemas
    sudo cp ~/git_projects/gnome-shell-system-monitor-applet/org.gnome.shell.extensions.system-monitor.gschema.xml /usr/local/share/glib-2.0/schemas
    sudo glib-compile-schemas /usr/local/share/glib-2.0/schemas

To install the configurator (you need python and py3gobject):

    sudo cp ~/git_projects/gnome-shell-system-monitor-applet/system-monitor-applet-config.py /usr/local/bin/system-monitor-applet-config

To install locale you need gettext:

    sudo msgfmt ~/git_project/gnome-shell-system-monitor-applet/po/YOUR_LANGUAGE/system-monitor-applet.po -o /usr/share/locale/YOUR_LANGUAGE/LC_MESSAGES/system-monitor-applet.mo

And restart gnome-shell (Alt + F2 -> r) or reboot.

If we do not have the translation of your language and you want to translate by yourself, please make a fork add your po/YOUR_LANG/system-monitor-applet.po file and make a pull request.


### Authors:
[paradoxxxzero](https://github.com/paradoxxxzero)
[yuyichao](https://github.com/yuyichao)
[darkxst](https://github.com/darkxst)
And [many contributors](https://github.com/paradoxxxzero/gnome-shell-system-monitor-applet/contributors)

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

