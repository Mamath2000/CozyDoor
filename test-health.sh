#!/bin/bash

# Script de test du health check CozyDoor
# Usage: ./test-health.sh

set -e

CONTAINER_NAME="cozydoor"
MQTT_HOST="${MQTT_HOST:-192.168.100.190}"
MQTT_PORT="${MQTT_PORT:-1883}"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           🏥 TEST HEALTH CHECK COZYDOOR                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Vérifier que le container existe
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ Container '${CONTAINER_NAME}' n'existe pas"
    echo "💡 Lancez d'abord: make docker-up"
    exit 1
fi

# Vérifier que le container tourne
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ Container '${CONTAINER_NAME}' n'est pas démarré"
    echo "💡 Lancez: make docker-up"
    exit 1
fi

echo "📊 Statut du container"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.State}}"
echo ""

echo "🏥 Health check status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' ${CONTAINER_NAME} 2>/dev/null || echo "no healthcheck")

case "$HEALTH_STATUS" in
    "healthy")
        echo "✅ Status: HEALTHY"
        ;;
    "unhealthy")
        echo "❌ Status: UNHEALTHY"
        ;;
    "starting")
        echo "⏳ Status: STARTING (en cours de démarrage)"
        ;;
    "no healthcheck")
        echo "⚠️  Aucun health check configuré"
        ;;
    *)
        echo "❓ Status: $HEALTH_STATUS"
        ;;
esac
echo ""

# Afficher les derniers logs de health check
if [ "$HEALTH_STATUS" != "no healthcheck" ]; then
    echo "📋 Historique des health checks (5 derniers)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    docker inspect ${CONTAINER_NAME} | jq -r '.[0].State.Health.Log[-5:] | .[] | "\(.Start | split(".")[0] | sub("T"; " ")) - Exit: \(.ExitCode) - \(if .ExitCode == 0 then "✅ OK" else "❌ FAIL" end)"' 2>/dev/null || echo "jq non disponible pour afficher l'historique détaillé"
    echo ""
fi

echo "📊 Processus Node.js dans le container"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker exec ${CONTAINER_NAME} ps aux | grep -E 'PID|node.*monitorAll' | grep -v grep || echo "❌ Processus Node.js non trouvé"
echo ""

echo "🌐 Test de connexion MQTT (${MQTT_HOST}:${MQTT_PORT})"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker exec ${CONTAINER_NAME} nc -zv ${MQTT_HOST} ${MQTT_PORT} && echo "✅ Port MQTT accessible" || echo "❌ Port MQTT non accessible"
echo ""

echo "📜 Derniers logs du container (20 dernières lignes)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker logs --tail 20 ${CONTAINER_NAME}
echo ""

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                     TEST TERMINÉ                             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
