import sys
from io import StringIO
from tcp_client import tcp_client
from ipaddress import ip_address

ip='192.168.90.205'
if len(sys.argv) == 1:
    ip = sys.argv[1]


device_buf = StringIO()

a = tcp_client(ip, timeout=0.1)
a._initSocket()
if a._connect:
        device_info = a._device_info()
        device_info_str = f'  - ip: {ip}\n'
        device_info_str += f'    did: {a._device_id}\n'
        device_info_str += f'    pid: {a._pid}\n'
        device_info_str += f'    dmn: {a._device_model_name}\n'
        device_info_str += f'    dpid: {a._dpid}\n'
        device_info_str += f'    device_type: {a._device_type_code}\n'

        print(device_info_str)
        state = a.query()
        print(a.query())

