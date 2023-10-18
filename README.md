![Extension uploader](https://github.com/mgalgs/gnome-shell-system-monitor-applet/workflows/Extension%20uploader/badge.svg)
![Repo syncer](https://github.com/mgalgs/gnome-shell-system-monitor-applet/workflows/Repo%20syncer/badge.svg)

This fork of `paradoxxxzero/gnome-shell-system-monitor-applet` is for
packaging purposes only. This fork contains Github Actions workflows
([here](.github/workflows)) to continuously sync against the upstream
`master` branch and upload the resulting build to extensions.gnome.org
([system-monitor-next](https://extensions.gnome.org/extension/3010/system-monitor-next/)).

Any issues, bug reports, feature requests, etc. for the extension itself
should be submitted to the [upstream
repo](https://github.com/paradoxxxzero/gnome-shell-system-monitor-applet),
but build/sync issues should be reported here.

The approach in this repo is preferable for users on bleeding edge
distributions who prefer not to wait for a stable release from the main
repo. Of course, since we're releasing directly from `master` some
instability is inevitable.

## GNOME Shell system monitor extension

[![Build Status](https://travis-ci.com/paradoxxxzero/gnome-shell-system-monitor-applet.svg?branch=master)](https://travis-ci.com/paradoxxxzero/gnome-shell-system-monitor-applet)

![screenshot-small](http://i.imgur.com/ka9OA.png)

![screenshot-mid](http://i.imgur.com/mmRTu.png)

![screenshot-large](http://i.imgur.com/X7Sss.png)

### Installation

#### Prerequisites

This extension [requires GNOME Shell v3.26 or later](https://github.com/paradoxxxzero/gnome-shell-system-monitor-applet/blob/master/system-monitor%40paradoxxx.zero.gmail.com/metadata.json#L2).

Before installing this extension, ensure you have the necessary system packages installed:

* On Ubuntu:

      sudo apt install gir1.2-gtop-2.0 gir1.2-nm-1.0 gir1.2-clutter-1.0 gnome-system-monitor

* On Debian:

      sudo apt install gir1.2-gtop-2.0 gir1.2-nm-1.0 gir1.2-clutter-1.0 gnome-system-monitor

* On Fedora:

      sudo dnf install libgtop2-devel NetworkManager-libnm-devel gnome-system-monitor

* On Arch Linux:

      sudo pacman -S libgtop networkmanager gnome-system-monitor clutter

* On openSUSE (Leap 42.1):

      sudo zypper install gnome-shell-devel libgtop-devel libgtop-2_0-10 gnome-system-monitor

* On Mageia 64-bit (just remove "64" on i586):

      sudo urpmi lib64gtop-gir2.0 lib64nm-gir1.0 lib64clutter-gir1.0 gnome-system-monitor

    or

      sudo dnf install lib64gtop-gir2.0 lib64nm-gir1.0 lib64clutter-gir1.0 gnome-system-monitor


Additionally, if you have an NVIDIA graphics card, and want to monitor its memory usage, you'll need to install `nvidia-smi`.

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
Additionally, rebooting gnome-shell may help (under X11: type `Alt + F2` and input `r` in
the prompt, or under Wayland: logout/login).

#### Manual installation

To install the extension from source, clone this repo and create the
appropriate symlink in the Gnome Shell extensions directory like so:

    cd ~/.local/share/gnome-shell/extensions
    ln -sv /path/to/gnome-shell-system-monitor-applet/system-monitor-next@paradoxxx.zero.gmail.com/

And reload your Gnome Shell session. You can do this in X11 by pressing
`Alt-F2`, then `r`. If using Wayland, you'll need to logout/login.

After reloading Gnome Shell, you can enable the extension from the
Extensions app, or by running:

    gnome-extensions enable system-monitor-next@paradoxxx.zero.gmail.com

If you're going to be doing development/testing under Wayland and don't
want to keep logging out/in you can use Gnome Shell's support for [nested
sessions under
Wayland](https://gjs.guide/extensions/development/creating.html#wayland-sessions). To
start a nested session, run:

    dbus-run-session -- gnome-shell --nested --wayland

then start a new terminal *inside* the nested session (it will show up
outside of the nested window, but don't panic; the dbus session address
will be configured to point at the nested session), and run the above
`gnome-extensions enable` command in your new terminal. You may also need
to enable extensions using the Gnome Extensions app inside your nested
session.

#### Translation

If we do not have the translation for your language and you want to translate it by yourself, please make a fork, add your `po/<YOUR_LANG>/system-monitor-applet.po` file, and make a pull request.

#### Deployment
    
1. To create a ZIP file with the specified version number, ready to upload to [GNOME Shell Extensions](https://extensions.gnome.org/) or similar repository, run:

    make zip-file VERSION=<version>

To determine the version number to use, check the extensions site and increment from the largest published version.

The specified version number is just for documentation and isn't strictly necessary in the uploaded file, since the extensions website will dynamically set this and override whatever we enter.

2. Once uploaded, [create a GitHub release](https://github.com/paradoxxxzero/gnome-shell-system-monitor-applet/releases) with the same version number.

### Authors

[paradoxxxzero](https://github.com/paradoxxxzero)
[yuyichao](https://github.com/yuyichao)
[darkxst](https://github.com/darkxst)
and [many contributors](https://github.com/paradoxxxzero/gnome-shell-system-monitor-applet/contributors)

### License

Copyright (C) 2011 Florian Mounier aka paradoxxxzero

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>.
