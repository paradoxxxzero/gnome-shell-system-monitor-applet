#!/usr/bin/env bash
# The top-level user script for executing tests from Docker.
# The first argument should be a distro identifier.

export DISTRO=${1:-ubuntu1804}

echo "[$(date)] Running $DISTRO tests."

COMPOSE_FILE_LOC="docker-compose.yml"

# This must match the name in the docker-compose.*.yml file.
TEST_CONTAINER_NAME="test"

COMPOSE_PROJECT_NAME_ORIGINAL="test_${BUILD_TAG}"
echo "[$(date)] COMPOSE_PROJECT_NAME_ORIGINAL=$COMPOSE_PROJECT_NAME_ORIGINAL"

# Project name is sanitized by Compose, so we need to do the same thing.
# See https://github.com/docker/compose/issues/2119.
COMPOSE_PROJECT_NAME=$(echo $COMPOSE_PROJECT_NAME_ORIGINAL | awk '{print tolower($0)}' | sed 's/[^a-z0-9]*//g')
echo "[$(date)] COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME"
TEST_CONTAINER_REF="${COMPOSE_PROJECT_NAME}_${TEST_CONTAINER_NAME}_1"
echo "[$(date)] TEST_CONTAINER_REF=$TEST_CONTAINER_REF"

# Record installed version of Docker and Compose with each build
echo "[$(date)] Docker environment:"
docker --version
docker-compose --version

function cleanup {
    echo "[$(date)] Shutting down..."
    docker-compose -f $COMPOSE_FILE_LOC -p $COMPOSE_PROJECT_NAME down --remove-orphans
    echo "[$(date)] Stopping..."
    docker ps -a --no-trunc | grep $COMPOSE_PROJECT_NAME | awk '{print $1}' | xargs --no-run-if-empty docker stop
    echo "[$(date)] Removing..."
    docker ps -a --no-trunc | grep $COMPOSE_PROJECT_NAME | awk '{print $1}' | xargs --no-run-if-empty docker rm
    echo "[$(date)] Delete old containers."
    docker system prune -a -f
}

function run_tests {
    echo "[$(date)] Creating containers..."
    docker-compose -f $COMPOSE_FILE_LOC -p $COMPOSE_PROJECT_NAME up --build --force-recreate --exit-code-from test
    ret_code=$?
    echo "[$(date)] Docker Compose exit code: $ret_code"

    # List images and containers related to this build
    docker images | grep $COMPOSE_PROJECT_NAME | awk '{print $0}'
    docker ps -a | grep $COMPOSE_PROJECT_NAME | awk '{print $0}'

    # Follow the container with tests...
    docker logs -f $TEST_CONTAINER_REF

    exit $ret_code
}

set -e
cleanup # Initial cleanup.
trap cleanup EXIT # Cleanup after tests finish running

run_tests
