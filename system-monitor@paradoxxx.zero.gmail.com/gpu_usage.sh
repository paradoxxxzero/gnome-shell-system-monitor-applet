#!/bin/sh
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
	command -v "$1" > /dev/null 2>&1
}

# This will print three lines. The first one is the the total vRAM available,
# the second one is the used vRAM and the third on is the GPU usage in %.
if checkcommand nvidia-smi; then
	nvidia-smi -i 0 --query-gpu=memory.total,memory.used,utilization.gpu --format=csv,noheader,nounits | while IFS=', ' read -r a b c; do echo "$a"; echo "$b"; echo "$c"; done

elif lsmod | grep amdgpu > /dev/null; then
	total=$(cat /sys/class/drm/card0/device/mem_info_vram_total)
	echo $(($total / 1024 / 1024))

	used=$(cat /sys/class/drm/card0/device/mem_info_vram_used)
	echo $(($used / 1024 / 1024))

	cat /sys/class/drm/card0/device/gpu_busy_percent

elif checkcommand glxinfo; then
	TOTALVRAM=$(glxinfo | grep -A2 -i GL_NVX_gpu_memory_info | grep -E -i "dedicated" | cut -f2- -d ':' | gawk '{print $1}')
	AVAILVRAM=$(glxinfo | grep -A4 -i GL_NVX_gpu_memory_info | grep -E -i "available dedicated" | cut -f2- -d ':' | gawk '{print $1}')
	FREEVRAM=$((TOTALVRAM-AVAILVRAM))
	echo "$TOTALVRAM"
	echo "$FREEVRAM"

fi
