# CozyDoor - Node.js Version

CozyDoor est un service qui permet d'intégrer les capteurs de porte CosyLife avec Home Assistant via MQTT.

## � Documentation

- **[Guide de démarrage rapide](QUICKSTART.md)** - Commencer rapidement avec des exemples
- **[README complet](README.md)** - Documentation détaillée (ce fichier)

## �🔄 Migration Python vers Node.js

Ce projet a été entièrement converti de Python vers Node.js. L'ancienne version Python reste disponible dans la branche `main`.

## 📋 Prérequis

- Node.js (version 16 ou supérieure)
- npm
- Accès à un serveur MQTT
- Home Assistant (optionnel, pour l'auto-découverte)

## 🚀 Installation

### Installation ultra-rapide (recommandé pour débutants)

```bash
./quick_install.sh
```

Ce script interactif va :
- Vérifier les dépendances
- Installer les packages npm
- Créer le fichier de configuration
- Afficher les prochaines étapes

### Installation avec Make

```bash
# Voir toutes les commandes disponibles
make help

# Installation complète (dépendances + configuration)
make setup

# Ou étape par étape :
make install    # Installe les dépendances
make config     # Crée config.json
nano config.json  # Éditer la configuration
```

### Installation manuelle

```bash
# Installation des dépendances
npm install

# Copier le fichier de configuration exemple
cp config.json.sample config.json

# Éditer le fichier config.json avec vos paramètres
nano config.json
```

### Installation en tant que service systemd

#### Avec Make (recommandé)

```bash
# Installer un service
sudo make install-service IP=192.168.0.17 NAME=porte_entree FRIENDLY_NAME="Porte d'Entrée"

# Gérer le service
make status NAME=porte_entree          # Voir le statut
sudo make restart NAME=porte_entree    # Redémarrer
make logs NAME=porte_entree            # Voir les logs en temps réel
make logs-tail NAME=porte_entree       # Voir les dernières logs

# Désinstaller un service
sudo make uninstall-service NAME=porte_entree
```

#### Avec le script d'installation

```bash
sudo ./install_cozydoor_service.sh <IP> <NOM_COMPOSANT> <FRIENDLY_NAME>
```

Exemples :
```bash
sudo ./install_cozydoor_service.sh 192.168.0.17 porte_entree "Porte d'Entrée"
sudo ./install_cozydoor_service.sh 192.168.0.18 porte_garage "Porte Garage"
```

## ⚙️ Configuration

Éditez le fichier `config.json` :

```json
{
  "mqtt_host": "192.168.0.101",
  "mqtt_port": 1883,
  "base_topic": "CosyLife",
  "debug": false
}
```

## 🎯 Utilisation

### Avec Make (recommandé)

```bash
# Voir l'aide complète
make help

# Tester la connexion à un appareil
make test-getconf IP=192.168.0.17

# Exécuter en mode manuel (développement)
make run IP=192.168.0.17 NAME=porte_entree FRIENDLY_NAME="Porte d'Entrée"

# Mode développement avec debug
make dev IP=192.168.0.17 NAME=porte_entree FRIENDLY_NAME="Porte d'Entrée"

# Vérifier les dépendances système
make check-deps

# Lister tous les services installés
make list-services
```

### Exécution manuelle

```bash
# Surveiller un capteur de porte
node app/getDoorState.js <IP> <NOM_COMPOSANT> <FRIENDLY_NAME>

# Exemple
node app/getDoorState.js 192.168.0.17 porte_entree "Porte d'Entrée"
```

### Obtenir les informations d'un appareil

```bash
# Avec Make
make test-getconf IP=192.168.0.17

# Ou directement
node app/getconf.js 192.168.0.17
```

### Gestion du service systemd

```bash
# Avec Make
make status NAME=porte_entree
sudo make restart NAME=porte_entree
make logs NAME=porte_entree

# Ou avec systemctl
sudo systemctl status cozydoor_porte_entree
sudo systemctl restart cozydoor_porte_entree
sudo journalctl -u cozydoor_porte_entree -f
```

## 📦 Structure du projet

```
CozyDoor/
├── app/
│   ├── getDoorState.js    # Script principal de surveillance
│   ├── getconf.js          # Script pour obtenir les infos d'un appareil
│   ├── tcp_client.js       # Client TCP pour communiquer avec les appareils
│   └── utils.js            # Fonctions utilitaires
├── config.json.sample      # Exemple de configuration
├── homeAssistant-device-sample.json  # Exemple de configuration HA
├── install_cozydoor_service.sh       # Script d'installation
├── package.json            # Dépendances Node.js
└── README.md              # Ce fichier
```

## 🏠 Intégration Home Assistant

Le service publie automatiquement les topics de découverte Home Assistant. Les entités suivantes sont créées :

- **Contact** : État de la porte (ouvert/fermé)
- **Batterie** : Niveau de batterie en %
- **Alerte Batterie** : Alerte si batterie faible
- **IP Adresse** : Adresse IP de l'appareil

Les données sont publiées sur : `CosyLife/<NOM_COMPOSANT>`

## 🔍 Débogage

Pour activer le mode debug, modifiez `config.json` :

```json
{
  "debug": true
}
```

## 📝 Différences avec la version Python

- Utilisation de ES modules (import/export)
- Promises et async/await au lieu de code synchrone
- Bibliothèques Node.js natives (`net`, `fs`, `child_process`)
- Bibliothèques npm : `mqtt` et `axios`

## 📄 Licence

MIT

## 👤 Auteur

Mamath
