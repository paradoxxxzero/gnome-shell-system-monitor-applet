#!/bin/bash
# Runs Docker GUI tests.
# Note, you don't have to run the GUI tests in Docker.
# You can run the GUI tests locally by running testing/test_gui.py locally.
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

SCRIPT_DIR="$(dirname "$(readlink -f ${BASH_SOURCE[0]})")"
cd $SCRIPT_DIR

docker --version
ls -lah .
cat ../testing/stdout.log

if [ -s ../testing/stderr.log ]
then
    echo -e "${RED}Errors found!"
    cat ../testing/stderr.log
    echo -e "${NC}"
    exit 1
else
    echo -e "${GREEN}No errors detected.${NC}"
fi
