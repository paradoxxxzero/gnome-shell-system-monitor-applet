## Gnome shell system monitor extension

[![Build Status](https://img.shields.io/travis/paradoxxxzero/gnome-shell-system-monitor-applet.svg?branch=master)](https://travis-ci.org/paradoxxxzero/gnome-shell-system-monitor-applet)

![screenshot-small](http://i.imgur.com/ka9OA.png)

![screenshot-mid](http://i.imgur.com/mmRTu.png)

![screenshot-large](http://i.imgur.com/X7Sss.png)

### Installation

#### Prerequisites

This extension [requires GNOME Shell v3.26 or later](https://github.com/paradoxxxzero/gnome-shell-system-monitor-applet/blob/master/system-monitor%40paradoxxx.zero.gmail.com/metadata.json#L2).
Please see the alternate branches [gnome-3.0](https://github.com/paradoxxxzero/gnome-shell-system-monitor-applet/tree/gnome-3.0) and [gnome-3.2](https://github.com/paradoxxxzero/gnome-shell-system-monitor-applet/tree/gnome-3.2) if you are using an older version of GNOME Shell (check with `gnome-shell --version`).

Before installing this extension, ensure you have the necessary system packages installed:

* On Ubuntu:

      $ sudo apt install gir1.2-gtop-2.0 gir1.2-nm-1.0 gir1.2-clutter-1.0
      
* On Debian:

      $ sudo apt install gir1.2-gtop-2.0 gir1.2-nm-1.0 gir1.2-clutter-1.0

* On Fedora:

      $ sudo yum install --assumeyes libgtop2-devel NetworkManager-glib-devel
    
* On openSUSE (Leap 42.1):

      $ sudo zypper install gnome-shell-devel libgtop-devel libgtop-2_0-10

Additionally, if you have an Nvidia graphics card, and want to monitor its memory usage, you'll need to install `nvidia-smi`.

For the browser installation (recommended), you will need the GNOME Shell integration browser extension for
[Chrome](https://chrome.google.com/webstore/detail/gnome-shell-integration/gphhapmejobijbbhgpjhcjognlahblep),
[Firefox](https://addons.mozilla.org/en-US/firefox/addon/gnome-shell-integration/) or
[Opera](https://addons.opera.com/en/extensions/details/gnome-shell-integration/).

Note: If you're using Firefox 52 or later, [you will also need to install `chrome-gnome-shell`](https://blogs.gnome.org/ne0sight/2016/12/25/how-to-install-gnome-shell-extensions-with-firefox-52/).
The instructions are available [on the GNOME wiki](https://wiki.gnome.org/Projects/GnomeShellIntegrationForChrome/Installation#Ubuntu_Linux).

#### Browser installation

It's recommended you install the extension via the Gnome Shell Extensions website.

Visit [this extension's page on extensions.gnome.org](https://extensions.gnome.org/extension/120/system-monitor/),
preferably in Firefox, and install by clicking the toggle button next to the extension's name.

If the install was successful, the toggle button should now show "ON".
If it failed, ensure that you installed all the [necessary dependencies](#prerequisites),
and that you granted the browser permission to install extensions when prompted.
Additionally, rebooting gnome-shell may help (type `Alt + F2` and input `r` in the prompt).

#### Repository installation

* Extension is in Fedora 25, 26, 27 and Rawhide repositories, you can install it for all users with the following command:

    $ sudo dnf install gnome-shell-extension-system-monitor-applet

* Enable it with `gnome-tweak-tool` or `gnome-shell-extension-tool --enable-extension=system-monitor@paradoxxx.zero.gmail.com`

#### Manual installation

[Download the ZIP/Tarball](https://github.com/paradoxxxzero/gnome-shell-system-monitor-applet/releases),
extract the archive, open a shell into its directory, and run:

    make install

Alternately, if you plan on doing development on the extension, or testing modifications, it's advised you checkout the Git repository and install a symlink. First, install git if you don't have it: (sudo apt-get install git-core, sudo pacman -S git, etc), then run:

    GIT_PROJECTS=~/git_projects
    PROJECT_NAME=system-monitor@paradoxxx.zero.gmail.com
    mkdir $GIT_PROJECTS
    cd $GIT_PROJECTS
    git clone git://github.com/paradoxxxzero/gnome-shell-system-monitor-applet.git $PROJECT_NAME
    mkdir -p ~/.local/share/gnome-shell/extensions
    cd ~/.local/share/gnome-shell/extensions
    { [ -d "./$PROJECT_NAME" ] || [ -L "./$PROJECT_NAME" ]; } && rm -Rf "./$PROJECT_NAME"
    ln -s $GIT_PROJECTS/gnome-shell-system-monitor-applet/$PROJECT_NAME
    gnome-shell-extension-tool --enable-extension=$PROJECT_NAME

And restart gnome-shell (`Alt + F2`, then `r`) or reboot the machine.

On openSUSE you need to install a devel package that provides the `gnome-shell-extension-tool` command:

    $ sudo zypper install gnome-shell-devel

### Development

#### Translation

If we do not have the translation of your language and you want to translate by yourself, please make a fork, add your po/YOUR_LANG/system-monitor-applet.po file, and make a pull request.

#### Deployment
    
1. To create a zip file with the specified version number, ready to upload to [Gnome Shell Extensions](https://extensions.gnome.org/) or similar repository, run:

    make zip-file VERSION=<version>

To determine the version number to use, check the extensions site and increment from the largest published version.

The specified version number is just for documentation and isn't strictly necessary in the uploaded file, since the extensions website will dynamically set this and override whatever we enter.

2. Once uploaded, [create a Github release](https://github.com/paradoxxxzero/gnome-shell-system-monitor-applet/releases) with the same version number.

### Authors

[paradoxxxzero](https://github.com/paradoxxxzero)
[yuyichao](https://github.com/yuyichao)
[darkxst](https://github.com/darkxst)
And [many contributors](https://github.com/paradoxxxzero/gnome-shell-system-monitor-applet/contributors)

### License

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
