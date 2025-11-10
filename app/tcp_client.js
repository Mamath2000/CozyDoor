import net from 'net';
import { getSn, getPidList, logger } from './utils.js';

const CMD_INFO = 0;
const CMD_QUERY = 2;
const CMD_SET = 3;

/**
 * Client TCP pour communiquer avec les appareils CosyLife
 */
export class TcpClient {
  constructor(ip, timeout = 3000) {
    this._ip = ip;
    this._port = 5555;
    this._connect = null;
    this.timeout = timeout;
    
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
  }

  /**
   * Initialise le socket TCP
   * @returns {Promise<boolean>}
   */
  async _initSocket() {
    return new Promise((resolve) => {
      try {
        const socket = new net.Socket();
        socket.setTimeout(this.timeout);

        socket.on('error', (err) => {
          logger.info(`_initSocketerror, ip=${this._ip}, error=${err.message}`);
          this.disconnect();
          resolve(false);
        });

        socket.on('timeout', () => {
          logger.info(`Socket timeout for ip=${this._ip}`);
          this.disconnect();
          resolve(false);
        });

        socket.connect(this._port, this._ip, () => {
          this._connect = socket;
          resolve(true);
        });
      } catch (e) {
        logger.info(`_initSocketerror, ip=${this._ip}`);
        this.disconnect();
        resolve(false);
      }
    });
  }

  /**
   * Vérifie si l'appareil est valide
   * @returns {boolean}
   */
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
   * Récupère les informations de l'appareil
   * @returns {Promise<object|null>}
   */
  async _device_info() {
    this._only_send(CMD_INFO, {});

    try {
      const resp = await this._receive();
      if (!resp) {
        return null;
      }

      let resp_json;
      try {
        resp_json = JSON.parse(resp.toString().trim());
      } catch (e) {
        logger.info('_device_info.recv.error - JSON parse failed');
        return null;
      }

      if (!resp_json.msg || typeof resp_json.msg !== 'object') {
        logger.info('_device_info.recv.error1');
        return null;
      }

      if (!resp_json.msg.did) {
        logger.info('_device_info.recv.error2');
        return null;
      }

      this._device_id = resp_json.msg.did;

      if (!resp_json.msg.pid) {
        logger.info('_device_info.recv.error3');
        return null;
      }

      this._pid = resp_json.msg.pid;

      const pid_list = await getPidList();
      for (const item of pid_list) {
        let match = false;
        for (const item1 of item.device_model) {
          if (item1.device_product_id === this._pid) {
            match = true;
            this._icon = item1.icon;
            this._device_model_name = item1.device_model_name;
            this._dpid = item1.dpid;
            break;
          }
        }

        if (match) {
          this._device_type_code = item.device_type_code;
          break;
        }
      }

      logger.info(`Device ID: ${this._device_id}`);
      logger.info(`Device Type Code: ${this._device_type_code}`);
      logger.info(`PID: ${this._pid}`);
      logger.info(`Model Name: ${this._device_model_name}`);
      logger.info(`Icon: ${this._icon}`);

      return resp_json.msg;
    } catch (e) {
      logger.info(`_device_info error: ${e.message}`);
      return null;
    }
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
    logger.info(`_package=${payload_str}`);
    return Buffer.from(payload_str + '\r\n', 'utf8');
  }

  /**
   * Reçoit les données du socket
   * @returns {Promise<Buffer|null>}
   */
  async _receive() {
    return new Promise((resolve) => {
      if (!this._connect) {
        resolve(null);
        return;
      }

      const timeout = setTimeout(() => {
        resolve(null);
      }, this.timeout);

      this._connect.once('data', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });

      this._connect.once('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });
  }

  /**
   * Envoie et reçoit des données
   * @param {number} cmd 
   * @param {object} payload 
   * @returns {Promise<object|null>}
   */
  async _send_receiver(cmd, payload) {
    try {
      const pkg = this._get_package(cmd, payload);
      this._connect.write(pkg);
    } catch (e) {
      try {
        this.disconnect();
        await this._initSocket();
        const pkg = this._get_package(cmd, payload);
        this._connect.write(pkg);
      } catch (e2) {
        return null;
      }
    }

    try {
      let i = 10;
      while (i > 0) {
        const res = await this._receive();
        if (!res) {
          i--;
          continue;
        }

        const resStr = res.toString();
        i--;

        // On vérifie que le SN correspond
        if (resStr.includes(this._sn)) {
          const payload_resp = JSON.parse(resStr.trim());
          
          if (!payload_resp || Object.keys(payload_resp).length === 0) {
            return null;
          }

          if (!payload_resp.msg || typeof payload_resp.msg !== 'object') {
            return null;
          }

          if (!payload_resp.msg.data || typeof payload_resp.msg.data !== 'object') {
            return null;
          }

          return payload_resp.msg.data;
        }
      }

      return null;
    } catch (e) {
      logger.info(`_send_receiver.recv.error: ${e.message}`);
      return null;
    }
  }

  /**
   * Envoie uniquement, sans recevoir
   * @param {number} cmd 
   * @param {object} payload 
   */
  _only_send(cmd, payload) {
    try {
      const pkg = this._get_package(cmd, payload);
      this._connect.write(pkg);
    } catch (e) {
      try {
        this.disconnect();
        this._initSocket();
        const pkg = this._get_package(cmd, payload);
        this._connect.write(pkg);
      } catch (e2) {
        this.disconnect();
      }
    }
  }

  /**
   * Contrôle l'appareil
   * @param {object} payload 
   * @returns {boolean}
   */
  control(payload) {
    this._only_send(CMD_SET, payload);
    return true;
  }

  /**
   * Interroge l'état de l'appareil
   * @returns {Promise<object|null>}
   */
  async query() {
    return this._send_receiver(CMD_QUERY, {});
  }
}
