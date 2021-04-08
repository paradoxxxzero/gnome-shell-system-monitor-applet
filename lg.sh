#!/bin/bash
# Launches the Gnome Shell Looking Glass debugging tool.
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval 'Main.lookingGlass.toggle();'
