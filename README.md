## Gnome shell system monitor extension

[![Build Status](https://img.shields.io/travis/paradoxxxzero/gnome-shell-system-monitor-applet.svg?branch=master)](https://travis-ci.org/paradoxxxzero/gnome-shell-system-monitor-applet)

![](http://i.imgur.com/ka9OA.png)

![](http://i.imgur.com/mmRTu.png)

![](http://i.imgur.com/X7Sss.png)

### Install:

Please see the alternate branches [gnome-3.0](https://github.com/paradoxxxzero/gnome-shell-system-monitor-applet/tree/gnome-3.0) and [gnome-3.2](https://github.com/paradoxxxzero/gnome-shell-system-monitor-applet/tree/gnome-3.2) if you are using an older version of gnome-shell.

It's recommended you install via the Gnome Shell Extensions website. However, before you do so, ensure you have the appropriate system packages installed.

On Ubuntu:

    $ sudo apt-get install gir1.2-gtop-2.0 gir1.2-networkmanager-1.0  gir1.2-clutter-1.0

On Fedora:

    $ sudo yum install --assumeyes libgtop2-devel NetworkManager-glib-devel
    
On openSUSE (Leap 42.1):

    $ sudo zypper install gnome-shell-devel libgtop-devel libgtop-2_0-10

Then, visit [extensions.gnome.org](https://extensions.gnome.org/extension/120/system-monitor/), preferrably in Firefox, and install by clicking the toggle button next to the extension's name. If the install was success, the toggle button should now show "ON".

If it failed, ensure you installed all the necessary dependencies, and that you granted the browser permission to install extensions when prompted. Additionally, try rebooting gnome-shell (Alt + F2 -> r).

#### Manual Install:

Download and extract the ZIP/Tarball, open a shell into its directory, and run:

    make install

Alternately, if you plan on doing development on the extension, or testing modifications, it's advised you checkout the Git repository and install a symlink. First, install git if you don't have it: (sudo apt-get install git-core, sudo pacman -S git, etc), then run:

    mkdir ~/git_projects
    cd ~/git_projects
    git clone git://github.com/paradoxxxzero/gnome-shell-system-monitor-applet.git    
    mkdir -p ~/.local/share/gnome-shell/extensions
    cd ~/.local/share/gnome-shell/extensions
    ln -s ~/git_projects/gnome-shell-system-monitor-applet/system-monitor@paradoxxx.zero.gmail.com
    gnome-shell-extension-tool --enable-extension=system-monitor@paradoxxx.zero.gmail.com

And restart gnome-shell (Alt + F2 -> r) or reboot.

On openSUSE you need to install a devel package that provides the gnome-shell-extension-tool command:

    $ sudo zypper install gnome-shell-devel

### Development:

#### Translation:

If we do not have the translation of your language and you want to translate by yourself, please make a fork, add your po/YOUR_LANG/system-monitor-applet.po file, and make a pull request.

#### Deployment:
    
To create a zip file with the specified version number, ready to upload to [Gnome Shell Extensions](https://extensions.gnome.org/) or similar repository, run:

    make zip-file VERSION=<version>

To determine the version number to use, check the extensions site and increment from the largest published version.

The specified version number is just for documentation and isn't strictly necessary in the uploaded file, since the extensions website will dynamically set this and override whatever we enter.

Once uploaded, [create a Github release](https://github.com/paradoxxxzero/gnome-shell-system-monitor-applet/releases) with the same version number.

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
