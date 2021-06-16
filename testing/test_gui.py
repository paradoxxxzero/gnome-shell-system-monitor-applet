#!/usr/bin/env python3
import os
import traceback

os.system('gsettings set org.gnome.desktop.interface toolkit-accessibility true')#TODO:remove, redundant?

os.system('touch RUNNING')
try:
    from dogtail import logging, predicate, rawinput, tree, utils

    # Roles
    ROLE_FILLER = "filler"
    ROLE_FRAME = "frame"
    ROLE_LABEL = "label"
    ROLE_MENU_ITEM = "menu item"
    ROLE_PANEL = "panel"
    ROLE_PUSH_BUTTON = "push button"
    ROLE_TOGGLE_BUTTON = "toggle button"
    ROLE_WINDOW = "window"

    # start gnome-tweaks
    utils.run("gnome-tweaks")

    # click on Extensions label
    tweaks_node = tree.root.application("gnome-tweaks")
    tweaks_node \
        .child(name="Extensions", roleName=ROLE_LABEL) \
        .click()

    # enable applet
    applet_text_node = tweaks_node.child(name="System-monitor", roleName=ROLE_LABEL)
    toggle_button_node = applet_text_node \
        .findAncestor(predicate.GenericPredicate(roleName=ROLE_FILLER)) \
        .findAncestor(predicate.GenericPredicate(roleName=ROLE_FILLER)) \
        .child(roleName=ROLE_TOGGLE_BUTTON)
    if not toggle_button_node.isChecked:
        toggle_button_node.click()

    # close gnome-tweaks
    tweaks_node \
        .child(name="Close", roleName=ROLE_PUSH_BUTTON) \
        .click()

    # click on the graphical widget
    shell_window_node = tree.root.application("gnome-shell") \
        .child(roleName=ROLE_WINDOW)
    panel_node = shell_window_node \
        .child(name="Cpu", roleName=ROLE_LABEL) \
        .findAncestor(predicate.GenericPredicate(roleName=ROLE_PANEL))
    applet_position = ((shell_window_node.size[0] - 100), 0) # approximation
    rawinput.click(*applet_position)

    # find the cpu value
    strings = panel_node.getUserVisibleStrings()
    cpu_idx = strings.index("Cpu") + 1
    cpu_value = int(strings[cpu_idx])
    assert cpu_value >= 0
    logging.debugLogger.log(f"{cpu_value=}")

    # open applet preference dialog
    perference_menu_item_node = panel_node \
        .findAncestor(predicate.GenericPredicate(roleName=ROLE_PANEL)) \
        .findAncestor(predicate.GenericPredicate(roleName=ROLE_PANEL)) \
        .child(name="Preferences...", roleName=ROLE_LABEL) \
        .findAncestor(predicate.GenericPredicate(roleName=ROLE_MENU_ITEM))
    rawinput.click(*perference_menu_item_node.position)

    # close applet preference dialog
    applet_preference_panel = tree.root.application("org.gnome.Shell.Extensions") \
        .child(name="system-monitor", roleName=ROLE_FRAME) \
        .child(roleName=ROLE_PANEL)
    rawinput.click(*applet_preference_panel.position)  # activate dialog
    applet_preference_panel \
        .child(name="Close", roleName=ROLE_PUSH_BUTTON) \
        .click()

except Exception as exc:
    traceback.print_exc()
finally:
    os.system('rm RUNNING')
