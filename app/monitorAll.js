import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mqtt from 'mqtt';
import { TcpClient } from './tcp_client.js';
import { logger } from './utils.js';
import { HomeAssistant } from './homeassistant.js';

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
// Les capteurs dorment et ne sont joignables que quelques instants après un événement (mesuré : 0,4 à 12 s,
// 10 à 13 s après l'ouverture/fermeture) : on tente une connexion TCP toutes les probe_interval ms, sans
// attendre la fin des tentatives précédentes ; la première connexion après le réveil peut prendre ~400 ms.
const probe_interval = config.probe_interval || 250;
const connect_timeout = config.connect_timeout || 1000;
const max_in_flight = Math.ceil(connect_timeout / probe_interval) + 2;

// Configuration du logger selon le mode debug
if (!debug_mode) {
  logger.debug = () => {}; // Désactive les logs debug
}

for (const key of ['polling_interval', 'connection_timeout', 'retry_delay']) {
  if (key in config) {
    logger.info(`config.json : "${key}" n'est plus utilisé (voir probe_interval, connect_timeout)`);
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

  const device = { id: null, model: null };  // lu une fois, au premier réveil
  let seq = 0;           // numéro de la dernière tentative lancée
  let publishedSeq = 0;  // tentative dont l'état a été publié (les réponses peuvent arriver dans le désordre)
  let lastPayload = null;
  let lastSummary = null;
  let awake = false;
  let wakeAt = 0;
  let lastOk = 0;
  let inFlight = 0;

  const attempt = async (n) => {
    const client = new TcpClient(ip, connect_timeout);
    try {
      if (!await client._initSocket()) {
        if (awake && Date.now() - lastOk > connect_timeout + 2 * probe_interval) {
          awake = false;
          logger.info(`[${name}] Endormi (éveillé ~${((lastOk - wakeAt) / 1000).toFixed(1)} s)`);
        }
        return;
      }

      // état d'abord : la fenêtre de réveil peut être très courte
      const state = await client.query();
      if (!state) {
        logger.debug(`[${name}] Connecté mais pas d'état`);
        return;
      }

      const now = Date.now();
      if (!awake) {
        awake = true;
        wakeAt = now;
        logger.info(`[${name}] Réveil`);
      }
      lastOk = now;

      const jsondata = ha.formatSensorData(state, device.id, device.model, friendly_name, ip);
      if (!jsondata) {
        logger.debug(`[${name}] État incomplet ignoré : ${JSON.stringify(state)}`);
      } else if (n > publishedSeq) {
        publishedSeq = n;
        const payload = JSON.stringify(jsondata);
        if (payload !== lastPayload) {
          ha.publishState(mqttClient, name, jsondata);
          const summary = `Contact: ${jsondata.contact}, Batterie: ${jsondata.battery}%`;
          if (summary !== lastSummary) logger.info(`[${name}] ${summary}`);
          lastPayload = payload;
          lastSummary = summary;
        }
      }

      // identité de l'appareil, une seule fois, après la publication
      if (!device.id && await client._device_info()) {
        device.id = client.device_id;
        device.model = client.device_model_name;
        logger.info(`[${name}] Appareil ${device.id} (${device.model || 'modèle inconnu'}, pid ${client._pid})`);
      }
    } finally {
      client.disconnect();
    }
  };

  while (true) {
    if (inFlight < max_in_flight) {
      inFlight++;
      attempt(++seq)
        .catch((e) => logger.error(`[${name}] Erreur : ${e.message}`))
        .finally(() => { inFlight--; });
    }
    await sleep(probe_interval);
  }
}

/**
 * Fonction principale
 */
async function main() {
  logger.info('==== Starting CosyLife Multi-Sensor Monitor ====');
  logger.info(`MQTT: ${mqtt_host}:${mqtt_port}`);
  logger.info(`Base Topic: ${base_topic}`);
  logger.info(`Interrogation toutes les ${probe_interval} ms, connexion ${connect_timeout} ms max`);

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
