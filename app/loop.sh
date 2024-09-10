#!/bin/bash


DEVICE_IP=$IP
DEVICE_NAME=$NAME

# DEVICE_IP=192.168.90.205
# DEVICE_NAME=desk_windows

echo "Main loop: Scan for IP : "${DEVICE_IP}" ("${DEVICE_NAME}")"
while true
do
  echo Start searching
  ping_check=`fping -4 -t 10 ${DEVICE_IP} &> /dev/null && echo success || echo fail`

  while [ ${ping_check} != "success" ]
  do
    ping_check=`fping -4 -t 10 ${DEVICE_IP} &> /dev/null && echo success || echo fail`
    sleep 1
  done

  sleep 1
  echo "device connected : Update status"
  # timeout 10 python3 getconf.py ${DEVICE_IP}
  timeout 10 python3 getstate.py "${DEVICE_IP}" "${DEVICE_NAME}"

done
