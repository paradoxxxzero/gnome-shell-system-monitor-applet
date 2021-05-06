#!/usr/bin/env python3
"""
Runs a process and then kills it after a timeout while monitoring
its stdout.
"""

import subprocess
import os
import sys
import time
import threading

STARTED_TAG = b'Ubuntu 20.04'

os.chdir(os.path.dirname(os.path.abspath(__file__)))

class ProcessMonitor(threading.Thread):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.process = None
        self.t0 = 0
        self.timeout = 120

    def run(self):
        self.process = subprocess.Popen('./run-docker.sh', stdout=subprocess.PIPE)
        for line in iter(lambda: self.process.stdout.readline(), b''):
            sys.stdout.buffer.write(line)
            if STARTED_TAG in line:
                print('Starting timeout countdown.')
                self.t0 = time.time()

    @property
    def stale_seconds(self):
        return time.time() - self.t0

    def is_alive(self):
        return self.process is None or self.process.poll() is None

    def fresh(self):
        if not self.t0:
            return True
        if self.stale_seconds < self.timeout:
            return True
        return False

t = ProcessMonitor()
t.daemon = True
print('\rStarting run-docker.sh.')
t.start()

while 1:
    if not t.is_alive():
        print('\rProcess has exited.')
        break
    if t.fresh():
        if not t.t0:
            print('\rWaiting for console tag.')
        else:
            print('\rStale for %s seconds.' % t.stale_seconds)
    else:
        print('\rKilling stale process...')
        os.system('./close-docker.sh')
        break
    time.sleep(5)
