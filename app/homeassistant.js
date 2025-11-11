/**
 * Home Assistant Auto-Discovery Helper
 * Gère la génération des payloads de découverte pour Home Assistant
 */

export class HomeAssistant {
  /**
   * @param {string} base_topic - Topic MQTT de base (par défaut 'CosyLife')
   */
  constructor(base_topic = 'CosyLife') {
    this.base_topic = base_topic;
    this.status_topic = `${base_topic}/monitor/lwt`;
    this.identifiers = 'cosylife_monitor'
  }

  /**
   * Génère le payload de découverte pour le device CozyDoor Monitor
   * @returns {object} Payload de découverte pour le moniteur
   */
  generateMonitorDiscoveryPayload() {
    return {
      device: {
        identifiers: [this.identifiers],
        manufacturer: 'CozyDoor',
        model: 'Multi-Sensor Monitor',
        name: 'CozyDoor Monitor',
        sw_version: '2.0.0'
      },
      origin: {
        name: 'CozyDoor',
        sw_version: '2.0.0'
      },
      components: {
        monitor_status: {
          platform: 'binary_sensor',
          object_id: 'cozydoor_monitor_status',
          unique_id: 'cosylife_monitor_status',
          state_topic: this.status_topic,
          payload_on: 'online',
          payload_off: 'offline',
          device_class: 'connectivity',
          name: 'Statut',
          has_entity_name: true
        }
      }
    };
  }

  /**
   * Publie la découverte du moniteur CozyDoor
   * @param {object} mqttClient - Client MQTT
   */
  publishMonitorDiscovery(mqttClient) {
    const payload = this.generateMonitorDiscoveryPayload();
    const topic = 'homeassistant/device/cozydoor_monitor/config';
    
    mqttClient.publish(topic, JSON.stringify(payload), { qos: 0, retain: true });
  }

  /**
   * Publie le statut du moniteur
   * @param {object} mqttClient - Client MQTT
   * @param {string} status - 'online' ou 'offline'
   */
  publishMonitorStatus(mqttClient, status = 'online') {
    mqttClient.publish(this.status_topic, status, { qos: 1, retain: true });
  }

  /**
   * Configure le Last Will and Testament pour MQTT
   * @returns {object} Configuration LWT
   */
  getLwtConfig() {
    return {
      topic: this.status_topic,
      payload: 'offline',
      qos: 1,
      retain: true
    };
  }

  /**
   * Génère le payload de découverte Home Assistant pour un capteur
   * @param {string} name - Nom du capteur (object_id)
   * @param {string} friendly_name - Nom convivial du capteur
   * @returns {object} Payload de découverte Home Assistant
   */
  generateDiscoveryPayload(name, friendly_name, ip) {
    return {
      device: {
        identifiers: [`cosylife_${name}`],
        manufacturer: 'CosyLife',
        model: 'Door sensor',
        name: friendly_name,
        via_device: this.identifiers,
        connections: [
          [
            "ip",
            ip
          ]
        ]
      },
      origin: {
        name: 'CozyDoor'
      },
      availability: [{
        topic: this.status_topic
      }],
      availability_mode: "all",      
      components: {
        [`${name}_contact`]: {
          platform: 'binary_sensor',
          object_id: `${name}_contact`,
          unique_id: `cosylife_${name}_contact`,
          state_topic: `${this.base_topic}/${name}`,
          json_attributes_topic: `${this.base_topic}/${name}`,
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
          state_topic: `${this.base_topic}/${name}`,
          json_attributes_topic: `${this.base_topic}/${name}`,
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
          state_topic: `${this.base_topic}/${name}`,
          json_attributes_topic: `${this.base_topic}/${name}`,
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
          state_topic: `${this.base_topic}/${name}`,
          json_attributes_topic: `${this.base_topic}/${name}`,
          enabled_by_default: true,
          entity_category: 'diagnostic',
          name: 'IP Adresse',
          value_template: '{{ value_json.ip }}'
        }
      }
    };
  }

  /**
   * Génère le topic de découverte Home Assistant
   * @param {string} name - Nom du capteur
   * @returns {string} Topic de découverte
   */
  getDiscoveryTopic(name) {
    return `homeassistant/device/${name}/config`;
  }

  /**
   * Publie la découverte Home Assistant pour un capteur
   * @param {object} mqttClient - Client MQTT
   * @param {string} name - Nom du capteur
   * @param {string} friendly_name - Nom convivial
   */
  publishDiscovery(mqttClient, name, friendly_name, ip) {
    const payload = this.generateDiscoveryPayload(name, friendly_name, ip);
    const topic = this.getDiscoveryTopic(name);
    
    mqttClient.publish(topic, JSON.stringify(payload), { qos: 0, retain: true });
  }

  /**
   * Formate les données du capteur pour MQTT
   * @param {object} state - État du capteur
   * @param {string} device_id - ID du device
   * @param {string} device_model_name - Nom du modèle
   * @param {string} friendly_name - Nom convivial
   * @param {string} ip - Adresse IP
   * @returns {object} Données formatées pour MQTT
   */
  formatSensorData(state, device_id, device_model_name, friendly_name, ip) {
    return {
      battery: parseFloat(state['9'] / 10),
      contact: state['7'] === 1 ? 'on' : 'off',
      battery_low: state['9'] < 300 ? 'on' : 'off',
      device_id: device_id,
      device_model_name: device_model_name,
      friendly_name: friendly_name,
      ip: ip
    };
  }

  /**
   * Publie l'état du capteur sur MQTT
   * @param {object} mqttClient - Client MQTT
   * @param {string} name - Nom du capteur
   * @param {object} data - Données du capteur
   */
  publishState(mqttClient, name, data) {
    const topic = `${this.base_topic}/${name}`;
    mqttClient.publish(topic, JSON.stringify(data), { qos: 0, retain: true });
  }
}
