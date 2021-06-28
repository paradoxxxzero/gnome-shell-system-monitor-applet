#!/bin/bash
set -e
./docker/build-docker.sh
./docker/run_and_kill.py || true
./docker/check_output.sh
