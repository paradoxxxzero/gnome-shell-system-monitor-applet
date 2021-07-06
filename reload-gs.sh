#!/bin/bash
# Reloads Gnome-Shell. Programmatically equivalent of doing Alt+F2->"r".
busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'Meta.restart("Restarting...")'
