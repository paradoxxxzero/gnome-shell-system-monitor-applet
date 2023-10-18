![Extension uploader](https://github.com/mgalgs/gnome-shell-system-monitor-applet/workflows/Extension%20uploader/badge.svg)
![Repo syncer](https://github.com/mgalgs/gnome-shell-system-monitor-applet/workflows/Repo%20syncer/badge.svg)

This fork of `paradoxxxzero/gnome-shell-system-monitor-applet` was
originally for packaging purposes only, with the intent of maintaining a
continuously updated release [on
extensions.gnome.org](https://extensions.gnome.org/extension/3010/system-monitor-next/)
so that users wouldn't have to wait for the (often slow) release process of
the original project.

However, the upstream repo now appears to be unmaintained, so this
repository is now a full and proper fork.

## GNOME Shell system monitor NEXT extension

[![Build Status](https://travis-ci.com/paradoxxxzero/gnome-shell-system-monitor-applet.svg?branch=master)](https://travis-ci.com/paradoxxxzero/gnome-shell-system-monitor-applet)

![screenshot-small](http://i.imgur.com/ka9OA.png)

![screenshot-mid](http://i.imgur.com/mmRTu.png)

![screenshot-large](http://i.imgur.com/X7Sss.png)

### Installation

#### Prerequisites

This extension requires Gnome Shell 45 or later. For earlier versions,
please see the `pre-45` git branch.

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

Visit [this extension's page on extensions.gnome.org](https://extensions.gnome.org/extension/3010/system-monitor-next/),
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

This process is automated by [the uploader Github Action](actions/uploader).

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
