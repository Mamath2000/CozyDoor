import json
import logging
import sys
import time
import os

import paho.mqtt.client as mqtt
from tcp_client import tcp_client

# =================== Configuration ===============================
mqtt_host = "192.168.10.101"
mqtt_port = 1883
base_topic = "CosyLife"
# ==================================================================

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

def main():
    if len(sys.argv) < 3:
        print("Usage: python getDoorState.py <ip> <nom_composant>")
        sys.exit(1)

    ip = sys.argv[1]
    name = sys.argv[2]
    logger.info(" ==== Starting CosyLife Reader (mamath) === ")
    logger.debug("Scan IP : " + str(ip))

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
                    # client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
                    client = mqtt.Client()
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