#!/bin/sh
# Health check script for CozyDoor
# Reads MQTT config from config.json and tests connectivity

set -e

# Vérifier que le processus Node tourne
if ! ps aux | grep -v grep | grep "node.*monitorAll.js" > /dev/null; then
    echo "❌ Node.js process not running"
    exit 1
fi

# Lire la config MQTT depuis config.json
if [ ! -f /app/config.json ]; then
    echo "❌ config.json not found"
    exit 1
fi

# Extraire host et port MQTT du fichier config.json
# (node rather than grep -P: the Alpine image only ships BusyBox grep)
MQTT_HOST=$(node -p "require('/app/config.json').mqtt_host || 'localhost'" 2>/dev/null || echo "localhost")
MQTT_PORT=$(node -p "require('/app/config.json').mqtt_port || 1883" 2>/dev/null || echo "1883")

# Tester la connexion MQTT
if ! nc -zv "$MQTT_HOST" "$MQTT_PORT" 2>&1 > /dev/null; then
    echo "❌ Cannot connect to MQTT broker at $MQTT_HOST:$MQTT_PORT"
    exit 1
fi

echo "✅ Health check passed (MQTT: $MQTT_HOST:$MQTT_PORT)"
exit 0
