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
    global auto_discovery
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
        # client = mqtt.Client()
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        client.on_connect = on_connect

        logger.info("Connection to mqtt broker : http://{}:{}".format(mqtt_host, mqtt_port))

        client.username_pw_set(mqtt_user, mqtt_pwd)
        client.connect(mqtt_host, mqtt_port, keepalive=120)

        # QUERY device for status
        if auto_discovery:
            device_info = a._device_info()
            time.sleep(0.1)
        state = a.query()

        logger.debug("Status : " + str(state))

        a.disconnect()
        logger.debug("Disconnected")

        if auto_discovery:
            # SENT SENSOR DEF
            json_sensor_data={
                "device":{
                    "identifiers": [f'cosyLife_{a._device_id}'],
                    "manufacturer": "CosyLife",
                    "model": a._device_model_name,
                    "name": name,
                    "via_device":"python scripts"},
                "object_id": f'cosyLife_{a._device_id}_contact',
                "unique_id": f'cosyLife_{a._device_id}_contact',
                "value_template": "{{ value_json.contact }}",
                "payload_off": "off",
                "payload_on": "on",
                "device_class": "door",
                "name": "Contact",
                "json_attributes_topic": base_topic + "/" + name,
                "state_topic": base_topic + "/" + name
                }
            topic=f'homeassistant/binary_sensor/{a._device_id}/contact/config'
            client.publish(topic, json.dumps(json_sensor_data), qos=0, retain=True)

            json_sensor_data={
                "device":{
                    "identifiers": [f'cosyLife_{a._device_id}'],
                    "manufacturer": "CosyLife",
                    "model": a._device_model_name,
                    "name": name,
                    "via_device":"python scripts"},
                "entity_category":"diagnostic",
                "unique_id": f'cosyLife_{a._device_id}_battery_low',
                "object_id": f'cosyLife_{a._device_id}_battery_low',
                "state_topic": base_topic + "/" + name,
                "json_attributes_topic": base_topic + "/" + name,
                "payload_off": "off",
                "payload_on": "on",
                "name": "Alerte Batterie",
                "device_class": "battery",
                "value_template": "{{ value_json.battery_low }}"
                }
            topic=f'homeassistant/binary_sensor/{a._device_id}/battery_low/config'
            client.publish(topic, json.dumps(json_sensor_data), qos=0, retain=True)

            json_sensor_data={
                "device":{
                    "identifiers": [f'cosyLife_{a._device_id}'],
                    "manufacturer": "CosyLife",
                    "model": a._device_model_name,
                    "name": name,
                    "via_device":"python scripts"},
                "entity_category": "diagnostic",
                "enabled_by_default": True,
                "unique_id": f'cosyLife_{a._device_id}_battery',
                "object_id": f'cosyLife_{a._device_id}_battery',
                "state_topic": base_topic + "/" + name,
                "json_attributes_topic": base_topic + "/" + name,
                "device_class": "battery",
                "state_class": "measurement",
                "unit_of_measurement": "%",
                "name": "Batterie",
                "value_template": "{{ value_json.battery }}"
                }
            topic=f'homeassistant/sensor/{a._device_id}/battery/config'
            client.publish(topic, json.dumps(json_sensor_data), qos=0, retain=True)


        if state:
            jsondata={
                "battery": float(state["9"]/10),
                "contact": "on" if state["7"] == 1 else "off",
                "battery_low": "on" if state["9"] < 300 else "off",
                "ip": str(ip),
                "device_id": a._device_id,
                "pid": a._pid,
                "device_model_name": a._device_model_name,
                "device_type_code": a._device_type_code, 
                "device_info": device_info
            }

            # SENT STATE
            client.publish(base_topic + "/" + name, json.dumps(jsondata), qos=0, retain=True)

            logger.debug("Battery : {0}".format(state["9"]/10))
            logger.debug("State : {0}".format(state["7"]))

            time.sleep(1)

if __name__ == "__main__":

    main()
