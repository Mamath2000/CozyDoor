import net from 'net';
import { getSn, getPidList, logger } from './utils.js';

const CMD_INFO = 0;
const CMD_QUERY = 2;
const CMD_SET = 3;

/**
 * Client TCP pour communiquer avec les appareils CosyLife
 *
 * Le protocole est du JSON terminé par \r\n : les données reçues sont accumulées et découpées par ligne
 * (un événement 'data' peut contenir un message partiel ou plusieurs messages).
 */
export class TcpClient {
  /**
   * @param {string} ip
   * @param {number} timeout - délai max (ms) pour la connexion, puis pour chaque réponse
   */
  constructor(ip, timeout = 1000) {
    this._ip = ip;
    this._port = 5555;
    this._connect = null;
    this.timeout = timeout;

    this._buffer = '';
    this._messages = [];   // messages JSON reçus, pas encore consommés
    this._waiter = null;   // fonction appelée à l'arrivée d'un message

    this._device_id = null;
    this._pid = null;
    this._device_type_code = null;
    this._icon = null;
    this._device_model_name = null;
    this._dpid = [];
    this._sn = null;
  }

  /**
   * Déconnecte le socket
   */
  disconnect() {
    if (this._connect) {
      try {
        this._connect.destroy();
      } catch (e) {
        // Ignore les erreurs
      }
      this._connect = null;
    }
    if (this._waiter) this._waiter();
  }

  /**
   * Initialise le socket TCP
   * @returns {Promise<boolean>}
   */
  async _initSocket() {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!ok) socket.destroy();
        resolve(ok);
      };

      // délai sur la connexion seule : une fois connecté, chaque réponse a son propre délai (_receive)
      const timer = setTimeout(() => {
        logger.debug(`connect timeout, ip=${this._ip}`);
        done(false);
      }, this.timeout);

      socket.on('error', (err) => {
        logger.debug(`socket error, ip=${this._ip}, error=${err.message}`);
        if (settled) this.disconnect(); else done(false);
      });

      socket.on('close', () => {
        if (this._connect === socket) this._connect = null;
        if (this._waiter) this._waiter();
      });

      socket.on('data', (data) => {
        this._buffer += data.toString();
        let idx;
        while ((idx = this._buffer.indexOf('\n')) >= 0) {
          const line = this._buffer.slice(0, idx).trim();
          this._buffer = this._buffer.slice(idx + 1);
          if (!line) continue;
          try {
            this._messages.push(JSON.parse(line));
          } catch (e) {
            logger.debug(`invalid JSON from ${this._ip}: ${line}`);
          }
        }
        if (this._waiter) this._waiter();
      });

      socket.connect(this._port, this._ip, () => {
        this._connect = socket;
        done(true);
      });
    });
  }

  get check() {
    return true;
  }

  get dpid() {
    return this._dpid;
  }

  get device_model_name() {
    return this._device_model_name;
  }

  get icon() {
    return this._icon;
  }

  get device_type_code() {
    return this._device_type_code;
  }

  get device_id() {
    return this._device_id;
  }

  /**
   * Récupère les informations de l'appareil (did, pid) ; le nom du modèle vient de l'API doiting
   * si elle répond (facultatif).
   * @param {boolean} withModel - interroger l'API doiting pour le nom du modèle
   * @returns {Promise<object|null>}
   */
  async _device_info(withModel = true) {
    const msg = await this._send_receiver(CMD_INFO, {});
    if (!msg || !msg.did || !msg.pid) {
      logger.debug(`_device_info: réponse incomplète de ${this._ip}`);
      return null;
    }

    this._device_id = msg.did;
    this._pid = msg.pid;
    this._device_type_code = msg.dtp ?? null;

    if (withModel) {
      const pid_list = await getPidList();
      for (const item of pid_list) {
        const model = (item.device_model || []).find((m) => m.device_product_id === this._pid);
        if (model) {
          this._icon = model.icon;
          this._device_model_name = model.device_model_name;
          this._dpid = model.dpid;
          this._device_type_code = item.device_type_code;
          break;
        }
      }
    }

    return msg;
  }

  /**
   * Crée un paquet de message
   * @param {number} cmd
   * @param {object} payload
   * @returns {Buffer}
   */
  _get_package(cmd, payload) {
    this._sn = getSn();
    let message;

    if (cmd === CMD_SET) {
      message = {
        pv: 0,
        cmd: cmd,
        sn: this._sn,
        msg: {
          attr: Object.keys(payload).map(k => parseInt(k)),
          data: payload
        }
      };
    } else if (cmd === CMD_QUERY) {
      message = {
        pv: 0,
        cmd: cmd,
        sn: this._sn,
        msg: {
          attr: [0]
        }
      };
    } else if (cmd === CMD_INFO) {
      message = {
        pv: 0,
        cmd: cmd,
        sn: this._sn,
        msg: {}
      };
    } else {
      throw new Error('CMD is not valid');
    }

    const payload_str = JSON.stringify(message);
    logger.debug(`_package=${payload_str}`);
    return Buffer.from(payload_str + '\r\n', 'utf8');
  }

  /**
   * Attend le message portant le numéro de série sn
   * @param {string} sn
   * @returns {Promise<object|null>} message complet, ou null (délai dépassé, socket fermé)
   */
  async _receive(sn) {
    const deadline = Date.now() + this.timeout;
    while (true) {
      const i = this._messages.findIndex((m) => String(m.sn) === sn);
      if (i >= 0) return this._messages.splice(i, 1)[0];
      const left = deadline - Date.now();
      if (!this._connect || left <= 0) return null;
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, left);
        this._waiter = () => { clearTimeout(timer); resolve(); };
      });
      this._waiter = null;
    }
  }

  /**
   * Envoie une commande et attend sa réponse
   * @param {number} cmd
   * @param {object} payload
   * @returns {Promise<object|null>} champ msg de la réponse
   */
  async _send_receiver(cmd, payload) {
    if (!this._connect) return null;
    try {
      this._connect.write(this._get_package(cmd, payload));
    } catch (e) {
      logger.debug(`write error, ip=${this._ip}: ${e.message}`);
      return null;
    }
    const resp = await this._receive(this._sn);
    if (!resp || !resp.msg || typeof resp.msg !== 'object') return null;
    return resp.msg;
  }

  /**
   * Contrôle l'appareil (envoi sans attendre de réponse)
   * @param {object} payload
   * @returns {boolean}
   */
  control(payload) {
    if (!this._connect) return false;
    this._connect.write(this._get_package(CMD_SET, payload));
    return true;
  }

  /**
   * Interroge l'état de l'appareil
   * @returns {Promise<object|null>} attributs (ex: {"7": 1, "9": 1000})
   */
  async query() {
    const msg = await this._send_receiver(CMD_QUERY, {});
    if (!msg || !msg.data || typeof msg.data !== 'object') return null;
    return msg.data;
  }
}
