#!/bin/bash

DEVICE_IP=192.168.90.205
DEVICE_NAME=desk_windows

while true
do
  echo main loop
  ping_check=`fping -4 -t 10 ${DEVICE_IP} &> /dev/null && echo success || echo fail`

  while [ ${ping_check} != "success" ]
  do
    # echo "."

    ping_check=`fping -4 -t 10 ${DEVICE_IP} &> /dev/null && echo success || echo fail`
    sleep 0.1
    # sleep 2
  done

  sleep 2
  echo "device connected"
  # timeout 10 python3 getconf.py ${DEVICE_IP}
  timeout 10 python3 getstate.py "${DEVICE_IP}" "${DEVICE_NAME}"

done
