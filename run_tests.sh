#!/bin/bash
# Runs Docker GUI tests.
# Note, you don't have to run the GUI tests in Docker.
# You can run the GUI tests locally by running testing/test_gui.py locally.
set -e

./docker/build-docker.sh
./docker/run-docker.sh

cat testing/stderr.log
if [ -s testing/stderr.log ]
then
    echo "No errors detected."
else
    echo "Errors found!"
    exit 1
fi
