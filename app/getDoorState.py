import json
import logging
import sys
import time
import os

# Lecture du fichier de config à la racine
CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config.json")
with open(CONFIG_PATH, "r") as f:
    config = json.load(f)
mqtt_host = config.get("mqtt_host", "localhost")
mqtt_port = config.get("mqtt_port", 1883)
base_topic = config.get("base_topic", "CosyLife")

import paho.mqtt.client as mqtt
from tcp_client import tcp_client


logging.basicConfig(level=logging.ERROR, format='   %(asctime)s %(levelname)-8s %(message)s')
logger = logging.getLogger()

def on_connect(client, userdata, flags, reason_code, properties=None):
    """ Connection MQTT handler"""
    if reason_code == 0:
        logger.info("Connected to MQTT server, no error")
    if reason_code > 0:
        logger.info("Connected to MQTT server with error code " + str(reason_code))

def device_is_available(ip):
    """Retourne True si l'IP répond au ping."""
    response = os.system(f"ping -c 1 -W 1 {ip} > /dev/null 2>&1")
    return response == 0

def generate_ha_discovery_payload(name, friendly_name):
    return {
        "device": {
            "identifiers": [f"cosylife_{name}"],
            "manufacturer": "CosyLife",
            "model": "Door sensor",
            "name": friendly_name
        },
        "origin": {
            "name": "Home Assistant"
        },
        "components": {
            f"{name}_contact": {
                "platform": "binary_sensor",
                "object_id": f"{name}_contact",
                "unique_id": f"cosylife_{name}_contact",
                "state_topic": f"CosyLife/{name}",
                "json_attributes_topic": f"CosyLife/{name}",
                "value_template": "{{ value_json.contact }}",
                "payload_off": "off",
                "payload_on": "on",
                "device_class": "door",
                "name": "Contact",
                "has_entity_name": True
            },
            f"{name}_battery_low": {
                "platform": "binary_sensor",
                "object_id": f"{name}_battery_low",
                "unique_id": f"cosylife_{name}_battery_low",
                "state_topic": f"CosyLife/{name}",
                "json_attributes_topic": f"CosyLife/{name}",
                "entity_category": "diagnostic",
                "payload_off": "off",
                "payload_on": "on",
                "name": "Alerte Batterie",
                "device_class": "battery",
                "value_template": "{{ value_json.battery_low }}"
            },
            f"{name}_battery": {
                "platform": "sensor",
                "object_id": f"{name}_battery",
                "unique_id": f"cosylife_{name}_battery",
                "state_topic": f"CosyLife/{name}",
                "json_attributes_topic": f"CosyLife/{name}",
                "enabled_by_default": True,
                "entity_category": "diagnostic",
                "device_class": "battery",
                "state_class": "measurement",
                "unit_of_measurement": "%",
                "name": "Batterie",
                "value_template": "{{ value_json.battery }}"
            },
            f"{name}_ip": {
                "platform": "sensor",
                "object_id": f"{name}_ip",
                "unique_id": f"cosylife_{name}_ip",
                "state_topic": f"CosyLife/{name}",
                "json_attributes_topic": f"CosyLife/{name}",
                "enabled_by_default": True,
                "entity_category": "diagnostic",
                "name": "IP Adresse",
                "value_template": "{{ value_json.ip }}"
            }
        }
    }

def main():
    if len(sys.argv) < 4:
        print("Usage: python getDoorState.py <ip> <nom_composant> <friendly_name>")
        sys.exit(1)

    ip = sys.argv[1]
    name = sys.argv[2]
    friendly_name = sys.argv[3]
    logger.info(" ==== Starting CosyLife Reader (mamath) === ")
    logger.debug("Scan IP : " + str(ip))

    # MQTT configuration pour la découverte
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    # client.username_pw_set(mqtt_user, mqtt_pwd)
    client.connect(mqtt_host, mqtt_port, keepalive=120)
    client.loop_start()

    # Génération et publication du payload de découverte Home Assistant
    ha_payload = generate_ha_discovery_payload(name, friendly_name)
    discovery_topic = f"homeassistant/device/{name}/config"
    client.publish(discovery_topic, json.dumps(ha_payload), qos=0, retain=True)
    logger.info(f"Payload Home Assistant publié sur {discovery_topic}")


    while True:
        # Attente que l'IP soit disponible sur le réseau
        logger.info(f"Attente de l'apparition de l'IP {ip} sur le réseau...")
        while not device_is_available(ip):
            time.sleep(1)
        logger.info(f"L'IP {ip} est détectée sur le réseau, lancement du client.")

        # Tant que l'IP répond, on boucle toutes les secondes
        while device_is_available(ip):
            try:
                a = tcp_client(ip, timeout=0.1)
                time.sleep(0.3)
                a._initSocket()

                if a._connect:
                    logger.debug("Connected to device")

                    # MQTT configuration
                    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
                    client.on_connect = on_connect

                    logger.info("Connection to mqtt broker : http://{}:{}".format(mqtt_host, mqtt_port))

                    # client.username_pw_set(mqtt_user, mqtt_pwd)
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

                        logger.debug("JSON : " + json.dumps(jsondata))

                        # SENT STATE
                        client.publish(base_topic + "/" + name, json.dumps(jsondata), qos=0, retain=True)

                        logger.debug("Battery : {0}".format(state["9"]/10))
                        logger.debug("State : {0}".format(state["7"]))
                # else:
                #     logger.error("Connexion au device impossible")
            except Exception as e:
                logger.error(f"Erreur lors de la récupération d'état : {e}")

            time.sleep(1)  # boucle toutes les secondes

if __name__ == "__main__":
    main()