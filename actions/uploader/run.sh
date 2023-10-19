#!/bin/bash

set -e

[[ -d ./system-monitor-next@paradoxxx.zero.gmail.com ]] || {
    echo "Please execute this script from the root of the extension repo"
    exit 1
}
git config --global --add safe.directory /github/workspace
make zip-file clean
export USERNAME
export PASSWORD
export ZIPBALL=./dist/system-monitor-next@paradoxxx.zero.gmail.com.zip
python3 /app/upload.py
