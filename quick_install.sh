#!/bin/bash

# Script d'installation rapide pour CozyDoor
# Usage: ./quick_install.sh

echo "╔════════════════════════════════════════╗"
echo "║   CozyDoor - Installation Rapide      ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Vérifier si make est disponible
if ! command -v make &> /dev/null; then
    echo "❌ Make n'est pas installé"
    echo "Installation de make..."
    sudo apt update && sudo apt install -y make
fi

# Vérifier les dépendances
echo "🔍 Vérification des dépendances système..."
make check-deps
echo ""

# Installation
echo "📦 Installation des dépendances Node.js..."
make install
echo ""

# Configuration
if [ ! -f config.json ]; then
    echo "⚙️  Création du fichier de configuration..."
    make config
    echo ""
    echo "📝 Veuillez éditer config.json avec vos paramètres MQTT :"
    echo "   - mqtt_host : Adresse de votre serveur MQTT"
    echo "   - mqtt_port : Port MQTT (généralement 1883)"
    echo "   - base_topic : Topic MQTT de base (par défaut: CosyLife)"
    echo ""
    read -p "Voulez-vous éditer config.json maintenant ? (y/N) " edit_config
    if [ "$edit_config" = "y" ] || [ "$edit_config" = "Y" ]; then
        ${EDITOR:-nano} config.json
    fi
else
    echo "✅ config.json existe déjà"
fi

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   Installation terminée !              ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📚 Prochaines étapes :"
echo ""
echo "1. Tester la connexion à un appareil :"
echo "   make test-getconf IP=192.168.0.17"
echo ""
echo "2. Lancer en mode manuel pour tester :"
echo "   make run IP=192.168.0.17 NAME=porte_test FRIENDLY_NAME=\"Porte Test\""
echo ""
echo "3. Surveiller tous les capteurs avec Docker :"
echo "   make docker-build"
echo "   make docker-up"
echo ""
echo "4. Ou surveiller localement :"
echo "   make monitor"
echo ""
echo "5. Voir toutes les commandes disponibles :"
echo "   make help"
echo ""
echo "📖 Documentation :"
echo "   - Guide rapide : cat QUICKSTART.md"
echo "   - Guide Docker : cat DOCKER.md"
echo "   - Commandes Make : cat MAKE_COMMANDS.md"
echo "   - README complet : cat README.md"
echo ""
