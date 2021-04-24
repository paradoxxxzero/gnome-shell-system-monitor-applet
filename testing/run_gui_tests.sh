#!/bin/sh

gsettings set org.gnome.desktop.interface toolkit-accessibility true
python3 test_gui.py
