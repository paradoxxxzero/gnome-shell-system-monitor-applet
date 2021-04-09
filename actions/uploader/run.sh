#!/bin/bash

set -e

[[ -d ./system-monitor@paradoxxx.zero.gmail.com ]] || {
    echo "Please execute this script from the root of the extension repo"
    exit 1
}
make zip-file clean
export USERNAME
export PASSWORD
export ZIPBALL=./dist/system-monitor@paradoxxx.zero.gmail.com.zip
python3 /app/upload.py
