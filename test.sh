#!/bin/bash
set -e
./docker/build-docker.sh
python -u ./docker/run_and_kill.py || true
./docker/check_output.sh
