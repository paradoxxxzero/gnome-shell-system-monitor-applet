#!/bin/bash
##################################################################################
#    This file is part of System Monitor Gnome extension.
#    System Monitor Gnome extension is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#    System Monitor Gnome extension is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#    You should have received a copy of the GNU General Public License
#    along with System Monitor.  If not, see <http://www.gnu.org/licenses/>.
#    Copyright 2017 Fran Glais, David King, indigohedgehog@github.
##################################################################################

##################################
#                                #
#   Check for GPU memory usage   #
#                                #
##################################

checkcommand()
{
	type $1 > /dev/null 2>&1
	return "$?"
}

# This will print three lines. The first one is the the total vRAM available,
# the second one is the used vRAM and the third on is the GPU usage in %.
if checkcommand nvidia-smi; then
	nvidia-smi -i 0 --query-gpu=memory.total,memory.used,utilization.gpu --format=csv,noheader,nounits | sed 's%, %\n%g'
elif checkcommand intel_gpu_top; then
# * For intel gpus
# * Requires:
#   - apt install intel-gpu-tools
#   - add USER ability to execute
#       `USER ALL= NOPASSWD:/usr/bin/timeout 0.5s intel_gpu_top -l -s 400`
#       without password in sudoers
# * This section echoes: max and current frequencies and the busy % for the 3D capabilities.
        MAX_FREQ=`cat /sys/class/drm/card0/gt_max_freq_mhz`
        CUR_FREQ=`cat /sys/class/drm/card0/gt_act_freq_mhz`
        USAGE=`sudo timeout 0.5s intel_gpu_top -l -s 400 | awk '{if(NR>3) print $6}'`
        echo "$MAX_FREQ"
        echo "$CUR_FREQ"
        echo "$USAGE"
        echo "intel"
elif checkcommand glxinfo; then
	TOTALVRAM="`glxinfo | grep -A2 -i GL_NVX_gpu_memory_info | egrep -i "dedicated" | cut -f2- -d ':' | gawk '{print $1}'`"
	AVAILVRAM="`glxinfo | grep -A4 -i GL_NVX_gpu_memory_info | egrep -i "available dedicated" | cut -f2- -d ':' | gawk '{print $1}'`"
	let FREEVRAM=TOTALVRAM-AVAILVRAM
	echo "$TOTALVRAM"
	echo "$FREEVRAM"
fi
