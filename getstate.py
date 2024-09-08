import sys
from io import StringIO
from tcp_client import tcp_client
from ipaddress import ip_address
from os.path import exists



import paho.mqtt.client as mqtt
import logging
import json
import time

from os.path import exists


# =================== Configuration ===============================
mqtt_host = "192.168.0.199"
mqtt_port = 1883
mqtt_user = "pzem2mqtt"
mqtt_pwd = "me65AQjvMRyPN5jMhDL"
auto_discovery = True
discovery_topic = "homeassistant"
base_topic = "CosyLife"
local_tz = "Europe/Paris"
last_state ="-1"
# ==================================================================

logging.basicConfig(level=logging.DEBUG, format='   %(asctime)s %(levelname)-8s %(message)s')
#logging.basicConfig(level=logging.INFO, format='   %(asctime)s %(levelname)-8s %(message)s')
#logging.basicConfig(level=logging.ERROR, format='   %(asctime)s %(levelname)-8s %(message)s')
logger = logging.getLogger()

ip='192.168.90.1'


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
    global ip

    # if len(sys.argv) == 2:
    ip = sys.argv[1]
    name = sys.argv[2]
    logger.info(" ==== Starting CosyLife Reader (mamath) === ")
    logger.debug("Scan IP : " + str(ip))


    a = tcp_client(ip, timeout=0.1)
    time.sleep(0.1)
    a._initSocket()

    if a._connect:
        logger.debug("Connected to device")

        # MQTT configuration
        client = mqtt.Client()
        # client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        client.on_connect = on_connect

        logger.info("Connection to mqtt broker : http://{}:{}".format(mqtt_host, mqtt_port))

        client.username_pw_set(mqtt_user, mqtt_pwd)
        client.connect(mqtt_host, mqtt_port, keepalive=120)

        # QUERY device for status
        device_info = a._device_info()
        time.sleep(0.1)
        state = a.query()

        logger.debug("Device Info : " + str(device_info))
        logger.debug("Status : " + str(state))

        a.disconnect()
        logger.debug("Disconnected")

        if state:
            jsondata={
                "batt": float(state["9"]/10),
                "state": "on" if state["7"] == 1 else "off",
                "ip": str(ip),
                "device_id": a._device_id,
                "pid": a._pid,
                "device_model_name": a._device_model_name,
                "device_type_code": a._device_type_code
            }
            logger.debug("MQTT Publish : " + str(jsondata))
            client.publish(base_topic + "/" + name, json.dumps(jsondata), qos=0, retain=True)

            logger.debug("Battery : {0}".format(state["9"]/10))
            logger.debug("State : {0}".format(state["7"]))
        

if __name__ == "__main__":

    main()
