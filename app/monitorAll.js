import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import mqtt from 'mqtt';
import { TcpClient } from './tcp_client.js';
import { logger } from './utils.js';
import { HomeAssistant } from './homeassistant.js';

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
 * @param {HomeAssistant} ha - Instance Home Assistant
 */
async function monitorSensor(sensor, mqttClient, ha) {
  const { name, friendly_name, ip } = sensor;
  
  logger.info(`[${name}] Démarrage de la surveillance pour ${friendly_name} (${ip})`);
  
  // Publication de la découverte Home Assistant
  ha.publishDiscovery(mqttClient, name, friendly_name, ip);
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
          const jsondata = ha.formatSensorData(
            state,
            device_id,
            device_model_name,
            friendly_name,
            ip
          );

          ha.publishState(mqttClient, name, jsondata);
          
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

  // Créer l'instance Home Assistant
  const ha = new HomeAssistant(base_topic);

  // Connexion MQTT unique partagée avec LWT
  const mqttClient = mqtt.connect(`mqtt://${mqtt_host}:${mqtt_port}`, {
    keepalive: 120,
    will: ha.getLwtConfig()
  });

  mqttClient.on('connect', () => {
    logger.info('✓ Connecté au broker MQTT');
    
    // Publier la découverte du moniteur
    ha.publishMonitorDiscovery(mqttClient);
    logger.info('✓ Device CozyDoor Monitor créé dans Home Assistant');
    
    // Publier le statut online
    ha.publishMonitorStatus(mqttClient, 'online');
    logger.info('✓ Statut: online');
  });

  mqttClient.on('error', (err) => {
    logger.error(`Erreur MQTT: ${err.message}`);
  });

  // Variable pour éviter les appels multiples au shutdown
  let isShuttingDown = false;

  // Gestion propre de l'arrêt
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    logger.info('\n==== Arrêt du service ====');
    
    try {
      // Publier le statut offline
      ha.publishMonitorStatus(mqttClient, 'offline');
      
      // Attendre que le message soit envoyé
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Fermer la connexion MQTT proprement
      await new Promise((resolve) => {
        mqttClient.end(false, {}, () => {
          logger.info('✓ Connexion MQTT fermée');
          resolve();
        });
      });
    } catch (err) {
      logger.error(`Erreur lors de l'arrêt: ${err.message}`);
    }
    
    logger.info('✓ Arrêt terminé');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Attendre la connexion MQTT
  await new Promise((resolve) => {
    if (mqttClient.connected) {
      resolve();
    } else {
      mqttClient.once('connect', resolve);
    }
  });

  // Lancer la surveillance de chaque capteur en parallèle
  const promises = enabledSensors.map(sensor => monitorSensor(sensor, mqttClient, ha));
  
  // Afficher les capteurs surveillés
  enabledSensors.forEach(sensor => {
    logger.info(`  → ${sensor.friendly_name} (${sensor.name}) - ${sensor.ip}`);
  });

  // Attendre toutes les promesses (ne se termine jamais)
  await Promise.all(promises);
}

// Lancement
main().catch(err => {
  logger.error(`Erreur fatale : ${err.message}`);
  process.exit(1);
});
