#!/bin/bash

set -e

mkdir -pv ~/.ssh
ssh-keyscan github.com >> ~/.ssh/known_hosts

git config --global --add safe.directory /github/workspace
git config --global user.email mitch.special@gmail.com
git config --global user.name "Mitchel Humpherys"
git config --global http.postBuffer 1048576000

git remote add upstream https://github.com/paradoxxxzero/gnome-shell-system-monitor-applet.git

echo "Remotes:"
git remote -v

git fetch upstream
git rebase upstream/master || {
    echo "Couldn't rebase against upstream :(. Please rebase manually."
    # Right now the repo is in a mangled state, awaiting merge conflict
    # resolution. Abort the rebase to ensure that all of our fork patches
    # are present for subsequent actions.
    git rebase --abort
    exit 1
}
echo "After rebase: next=$(git rev-parse master) upstream=$(git rev-parse upstream/master)"
git push --force origin master
