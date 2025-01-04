import json
import logging
import sys
import time
# from io import StringIO
# from ipaddress import ip_address
# from os.path import exists

import paho.mqtt.client as mqtt
from tcp_client import tcp_client

# =================== Configuration ===============================
mqtt_host = "192.168.10.130"
mqtt_port = 1883
mqtt_user = "pzem2mqtt"
mqtt_pwd = "me65AQjvMRyPN5jMhDL"
base_topic = "CosyLife"
# ==================================================================

# logging.basicConfig(level=logging.DEBUG, format='   %(asctime)s %(levelname)-8s %(message)s')
# logging.basicConfig(level=logging.INFO, format='   %(asctime)s %(levelname)-8s %(message)s')
logging.basicConfig(level=logging.ERROR, format='   %(asctime)s %(levelname)-8s %(message)s')
logger = logging.getLogger()

ip='127.0.0.1'

#def on_connect(client, userdata, flags, rc):
def on_connect(client, userdata, flags, reason_code, properties=None):
    """ Connection MQTT handler"""
    if reason_code == 0:
        # success connect
        logger.info("Connected to MQTT server, no error")

    if reason_code > 0:
        # error processing
        logger.info("Connected to MQTT server with error code " + str(reason_code))

def main():
    global mqtt_host
    global mqtt_port
    global mqtt_user
    global mqtt_pwd
    global base_topic
    global ip

    # if len(sys.argv) == 2:
    ip = sys.argv[1]
    name = sys.argv[2]
    logger.info(" ==== Starting CosyLife Reader (mamath) === ")
    logger.debug("Scan IP : " + str(ip))

    a = tcp_client(ip, timeout=0.1)
    time.sleep(0.3)
    a._initSocket()

    if a._connect:
        logger.debug("Connected to device")

        # MQTT configuration
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        client.on_connect = on_connect

        logger.info("Connection to mqtt broker : http://{}:{}".format(mqtt_host, mqtt_port))

        client.username_pw_set(mqtt_user, mqtt_pwd)
        client.connect(mqtt_host, mqtt_port, keepalive=120)


        a._device_info()
        device_id = a._device_id
        device_model_name =  a._device_model_name

        state = a.query()

        logger.debug("Status : " + str(state))
        logger.debug("Device ID : " + str(device_id))
        logger.debug("Model : " + str(device_model_name))

        a.disconnect()
        logger.debug("Disconnected")

        if state:
            jsondata={
                "battery": float(state["9"]/10),
                "contact": "on" if state["7"] == 1 else "off",
                "battery_low": "on" if state["9"] < 300 else "off",
                "device_id": device_id,
                "device_model_name": device_model_name,
                "ip": str(ip)
            }
                # "device_type_code": a._device_type_code

            logger.debug("JSON : " + json.dumps(jsondata))

            # SENT STATE
            client.publish(base_topic + "/" + name, json.dumps(jsondata), qos=0, retain=True)

            logger.debug("Battery : {0}".format(state["9"]/10))
            logger.debug("State : {0}".format(state["7"]))

            time.sleep(1)

if __name__ == "__main__":

    main()
