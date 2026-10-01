import { TcpClient } from './tcp_client.js';

// IP du capteur en argument (le capteur doit être éveillé : ouvrir/fermer puis lancer dans les ~10 s)
const ip = process.argv[2];
if (!ip) {
  console.error('Usage: node app/getconf.js <ip>');
  process.exit(1);
}

console.log(`Scanning IP: ${ip}`);

async function main() {
  const client = new TcpClient(ip, 1000);
  
  const connected = await client._initSocket();
  
  if (connected) {
    const device_info = await client._device_info();
    
    const device_info_str = `  - ip: ${ip}
    did: ${client._device_id}
    pid: ${client._pid}
    dmn: ${client._device_model_name}
    dpid: ${JSON.stringify(client._dpid)}
    device_type: ${client._device_type_code}`;
    
    console.log(device_info_str);
    console.log('\nDevice Info:', device_info);
    
    const state = await client.query();
    console.log('\nDevice State:', state);
    
    client.disconnect();
  } else {
    console.log('Failed to connect to device');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
