import axios from 'axios';

// Logger simple
const logger = {
  debug: (...args) => console.log('[DEBUG]', ...args),
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

/**
 * Génère un numéro de série (timestamp en millisecondes)
 * @returns {string}
 */
export function getSn() {
  return String(Date.now());
}

// Cache pour get_pid_list
let _CACHE_PID = [];

/**
 * Récupère la liste des produits depuis l'API
 * @param {string} lang - Langue (par défaut 'en')
 * @returns {Promise<Array>}
 */
export async function getPidList(lang = 'en') {
  if (_CACHE_PID.length !== 0) {
    return _CACHE_PID;
  }

  const domain = 'api-us.doiting.com';
  const protocol = 'http';
  const urlPrefix = `${protocol}://${domain}`;

  try {
    const res = await axios.get(`${urlPrefix}/api/device_product/model`, {
      params: { lang },
      timeout: 3000
    });

    const pidList = res.data;

    if (pidList.ret !== '1') {
      logger.info('get_pid_list.result is not as expected');
      return [];
    }

    const info = pidList.info;
    if (!info || typeof info !== 'object' || !Array.isArray(info.list)) {
      logger.info('get_pid_list.result structure is not as expected');
      return [];
    }

    _CACHE_PID = info.list;
    return _CACHE_PID;
  } catch (e) {
    logger.error(`Error making API request: ${e.message}`);
    return [];
  }
}

export { logger };
