import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import mqtt from 'mqtt';
import { TcpClient } from './tcp_client.js';
import { logger } from './utils.js';

const execAsync = promisify(exec);

// Obtenir __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lecture du fichier de configuration
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

const mqtt_host = config.mqtt_host || 'localhost';
const mqtt_port = config.mqtt_port || 1883;
const base_topic = config.base_topic || 'CosyLife';
const debug_mode = config.debug || false;

// Configuration du logger selon le mode debug
if (!debug_mode) {
  logger.debug = () => {}; // Désactive les logs debug si pas en mode debug
}

/**
 * Vérifie si l'IP répond au ping
 * @param {string} ip 
 * @returns {Promise<boolean>}
 */
async function deviceIsAvailable(ip) {
  try {
    await execAsync(`ping -c 1 -W 1 ${ip}`);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Génère le payload de découverte Home Assistant
 * @param {string} name 
 * @param {string} friendly_name 
 * @returns {object}
 */
function generateHaDiscoveryPayload(name, friendly_name) {
  return {
    device: {
      identifiers: [`cosylife_${name}`],
      manufacturer: 'CosyLife',
      model: 'Door sensor',
      name: friendly_name
    },
    origin: {
      name: 'Home Assistant'
    },
    components: {
      [`${name}_contact`]: {
        platform: 'binary_sensor',
        object_id: `${name}_contact`,
        unique_id: `cosylife_${name}_contact`,
        state_topic: `CosyLife/${name}`,
        json_attributes_topic: `CosyLife/${name}`,
        value_template: '{{ value_json.contact }}',
        payload_off: 'off',
        payload_on: 'on',
        device_class: 'door',
        name: 'Contact',
        has_entity_name: true
      },
      [`${name}_battery_low`]: {
        platform: 'binary_sensor',
        object_id: `${name}_battery_low`,
        unique_id: `cosylife_${name}_battery_low`,
        state_topic: `CosyLife/${name}`,
        json_attributes_topic: `CosyLife/${name}`,
        entity_category: 'diagnostic',
        payload_off: 'off',
        payload_on: 'on',
        name: 'Alerte Batterie',
        device_class: 'battery',
        value_template: '{{ value_json.battery_low }}'
      },
      [`${name}_battery`]: {
        platform: 'sensor',
        object_id: `${name}_battery`,
        unique_id: `cosylife_${name}_battery`,
        state_topic: `CosyLife/${name}`,
        json_attributes_topic: `CosyLife/${name}`,
        enabled_by_default: true,
        entity_category: 'diagnostic',
        device_class: 'battery',
        state_class: 'measurement',
        unit_of_measurement: '%',
        name: 'Batterie',
        value_template: '{{ value_json.battery }}'
      },
      [`${name}_ip`]: {
        platform: 'sensor',
        object_id: `${name}_ip`,
        unique_id: `cosylife_${name}_ip`,
        state_topic: `CosyLife/${name}`,
        json_attributes_topic: `CosyLife/${name}`,
        enabled_by_default: true,
        entity_category: 'diagnostic',
        name: 'IP Adresse',
        value_template: '{{ value_json.ip }}'
      }
    }
  };
}

/**
 * Fonction de délai
 * @param {number} ms 
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fonction principale
 */
async function main() {
  // Récupération des arguments de configuration
  if (process.argv.length < 5) {
    console.log('Usage: node getDoorState.js <ip> <nom_composant> <friendly_name>');
    process.exit(1);
  }

  const ip = process.argv[2];
  const name = process.argv[3];
  const friendly_name = process.argv[4];

  logger.info(' ==== Starting CosyLife Reader (mamath) === ');
  logger.debug(`Scan IP : ${ip}`);

  // Configuration MQTT pour la découverte
  const client = mqtt.connect(`mqtt://${mqtt_host}:${mqtt_port}`, {
    keepalive: 120
  });

  client.on('connect', () => {
    logger.info('Connected to MQTT server, no error');
  });

  client.on('error', (err) => {
    logger.error(`MQTT error: ${err.message}`);
  });

  // Attendre la connexion MQTT
  await new Promise((resolve) => {
    if (client.connected) {
      resolve();
    } else {
      client.once('connect', resolve);
    }
  });

  // Génération et publication du payload de découverte Home Assistant
  const ha_payload = generateHaDiscoveryPayload(name, friendly_name);
  const discovery_topic = `homeassistant/device/${name}/config`;
  client.publish(discovery_topic, JSON.stringify(ha_payload), { qos: 0, retain: true });
  logger.info(`Payload Home Assistant publié sur ${discovery_topic}`);

  // Boucle principale
  while (true) {
    // Attente que l'IP soit disponible sur le réseau
    logger.info(`Attente de l'apparition de l'IP ${ip} sur le réseau...`);
    while (!(await deviceIsAvailable(ip))) {
      await sleep(1000);
    }
    logger.info(`L'IP ${ip} est détectée sur le réseau, lancement du client.`);

    // Tant que l'IP répond, on boucle toutes les secondes
    while (await deviceIsAvailable(ip)) {
      try {
        const a = new TcpClient(ip, 100);
        await sleep(300);
        const connected = await a._initSocket();

        if (connected) {
          logger.debug('Connected to device');

          await a._device_info();
          const device_id = a._device_id;
          const device_model_name = a._device_model_name;

          const state = await a.query();

          logger.info(`Status : ${JSON.stringify(state)}`);
          logger.info(`Device ID : ${device_id}`);
          logger.info(`Model : ${device_model_name}`);

          a.disconnect();
          logger.debug('Disconnected');

          if (state) {
            const jsondata = {
              battery: parseFloat(state['9'] / 10),
              contact: state['7'] === 1 ? 'on' : 'off',
              battery_low: state['9'] < 300 ? 'on' : 'off',
              device_id: device_id,
              device_model_name: device_model_name,
              friendly_name: friendly_name,
              ip: ip
            };

            logger.debug(`JSON : ${JSON.stringify(jsondata)}`);

            // Envoi de l'état
            client.publish(`${base_topic}/${name}`, JSON.stringify(jsondata), { qos: 0, retain: true });

            logger.debug(`Battery : ${state['9'] / 10}`);
            logger.debug(`State : ${state['7']}`);
          }
        } else {
          logger.info('Connexion au device impossible');
        }
      } catch (e) {
        logger.error(`Erreur lors de la récupération d'état : ${e.message}`);
      }

      await sleep(1000); // boucle toutes les secondes
    }
  }
}

// Lancement de la fonction principale
main().catch(err => {
  logger.error(`Erreur fatale : ${err.message}`);
  process.exit(1);
});
