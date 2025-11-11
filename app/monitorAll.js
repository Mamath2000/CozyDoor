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
const polling_interval = config.polling_interval || 1000;
const connection_timeout = config.connection_timeout || 100;
const retry_delay = config.retry_delay || 5000;

// Configuration du logger selon le mode debug
if (!debug_mode) {
  logger.debug = () => {}; // Désactive les logs debug
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
 * Gère un capteur individuel
 * @param {object} sensor 
 * @param {object} mqttClient 
 */
async function monitorSensor(sensor, mqttClient) {
  const { name, friendly_name, ip } = sensor;
  
  logger.info(`[${name}] Démarrage de la surveillance pour ${friendly_name} (${ip})`);
  
  // Publication de la découverte Home Assistant
  const ha_payload = generateHaDiscoveryPayload(name, friendly_name);
  const discovery_topic = `homeassistant/device/${name}/config`;
  mqttClient.publish(discovery_topic, JSON.stringify(ha_payload), { qos: 0, retain: true });
  logger.info(`[${name}] Payload Home Assistant publié`);

  while (true) {
    try {
      // Attendre que l'IP soit disponible
      if (!await deviceIsAvailable(ip)) {
        logger.debug(`[${name}] Appareil non disponible, attente de ${retry_delay}ms...`);
        await sleep(retry_delay);
        continue;
      }

      // Connexion au device
      const client = new TcpClient(ip, connection_timeout);
      await sleep(300);
      const connected = await client._initSocket();

      if (connected) {
        logger.debug(`[${name}] Connecté au device`);

        await client._device_info();
        const device_id = client._device_id;
        const device_model_name = client._device_model_name;

        const state = await client.query();

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

          mqttClient.publish(`${base_topic}/${name}`, JSON.stringify(jsondata), { qos: 0, retain: true });
          
          logger.debug(`[${name}] État publié - Batterie: ${jsondata.battery}%, Contact: ${jsondata.contact}`);
        }

        client.disconnect();
      } else {
        logger.debug(`[${name}] Échec de connexion`);
      }
    } catch (e) {
      logger.error(`[${name}] Erreur : ${e.message}`);
    }

    await sleep(polling_interval);
  }
}

/**
 * Fonction principale
 */
async function main() {
  logger.info('==== Starting CosyLife Multi-Sensor Monitor ====');
  logger.info(`MQTT: ${mqtt_host}:${mqtt_port}`);
  logger.info(`Base Topic: ${base_topic}`);
  
  // Vérifier qu'il y a des capteurs configurés
  if (!config.sensors || config.sensors.length === 0) {
    logger.error('Aucun capteur configuré dans config.json');
    process.exit(1);
  }

  // Filtrer les capteurs activés
  const enabledSensors = config.sensors.filter(s => s.enabled !== false);
  
  if (enabledSensors.length === 0) {
    logger.error('Aucun capteur activé dans config.json');
    process.exit(1);
  }

  logger.info(`${enabledSensors.length} capteur(s) activé(s)`);

  // Connexion MQTT unique partagée
  const mqttClient = mqtt.connect(`mqtt://${mqtt_host}:${mqtt_port}`, {
    keepalive: 120
  });

  mqttClient.on('connect', () => {
    logger.info('✓ Connecté au broker MQTT');
  });

  mqttClient.on('error', (err) => {
    logger.error(`Erreur MQTT: ${err.message}`);
  });

  // Attendre la connexion MQTT
  await new Promise((resolve) => {
    if (mqttClient.connected) {
      resolve();
    } else {
      mqttClient.once('connect', resolve);
    }
  });

  // Lancer la surveillance de chaque capteur en parallèle
  const promises = enabledSensors.map(sensor => monitorSensor(sensor, mqttClient));
  
  // Afficher les capteurs surveillés
  enabledSensors.forEach(sensor => {
    logger.info(`  → ${sensor.friendly_name} (${sensor.name}) - ${sensor.ip}`);
  });

  // Attendre toutes les promesses (ne se termine jamais)
  await Promise.all(promises);
}

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  logger.info('\n==== Arrêt du service ====');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('\n==== Arrêt du service ====');
  process.exit(0);
});

// Lancement
main().catch(err => {
  logger.error(`Erreur fatale : ${err.message}`);
  process.exit(1);
});
