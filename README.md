# CozyDoor - Node.js Version

CozyDoor est un service qui permet d'intégrer les capteurs de porte CosyLife avec Home Assistant via MQTT.

## 📖 Documentation

- **[Guide de démarrage rapide](QUICKSTART.md)** - Commencer rapidement avec des exemples
- **[Guide Docker](DOCKER.md)** - Déploiement avec Docker (mode host requis)
- **[Commandes Make](MAKE_COMMANDS.md)** - Référence des commandes Makefile
- **[Guide du développeur](CONTRIBUTING.md)** - Contribuer au projet
- **[README complet](README.md)** - Documentation détaillée (ce fichier)

## �🔄 Migration Python vers Node.js

Ce projet a été entièrement converti de Python vers Node.js. L'ancienne version Python reste disponible dans la branche `main`.

## 📋 Prérequis

- Node.js (version 16 ou supérieure) OU Docker
- npm (si installation native)
- Accès à un serveur MQTT
- Home Assistant (optionnel, pour l'auto-découverte)
- Réseau local avec les capteurs CosyLife

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

### 🐳 Installation avec Docker (recommandé pour production)

**⚠️ Mode `host` OBLIGATOIRE** - Le container doit scanner le réseau local

```bash
# Installation rapide
make docker-build
make config
make docker-up

# Voir les logs
make docker-logs

# Arrêter
make docker-down

# Build et publication sur Docker Hub (auto-increment version)
make docker-publish
```

📖 **[Guide Docker complet](DOCKER.md)** pour plus d'informations sur la publication

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

### Avec Docker (recommandé)

```bash
# Démarrer en arrière-plan
make docker-up

# Voir les logs en temps réel
make docker-logs

# Arrêter
make docker-down

# Redémarrer
make docker-restart
```

### Avec Make (développement)

```bash
# Voir l'aide complète
make help

# Tester la connexion à un appareil
make test-getconf IP=192.168.0.17

# Exécuter en mode manuel (développement)
make run IP=192.168.0.17 NAME=porte_entree FRIENDLY_NAME="Porte d'Entrée"

# Surveiller tous les capteurs depuis config.json
make monitor

# Mode développement avec debug
make dev IP=192.168.0.17 NAME=porte_entree FRIENDLY_NAME="Porte d'Entrée"

# Vérifier les dépendances système
make check-deps
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

### Surveillance multi-capteurs

Configurez plusieurs capteurs dans `config.json` :

```json
{
  "mqtt_host": "192.168.0.101",
  "mqtt_port": 1883,
  "base_topic": "CosyLife",
  "debug": false,
  "sensors": [
    {
      "ip": "192.168.0.17",
      "name": "porte_entree",
      "friendly_name": "Porte d'Entrée"
    },
    {
      "ip": "192.168.0.18",
      "name": "porte_garage",
      "friendly_name": "Porte Garage"
    }
  ]
}
```

Puis lancez :
```bash
make monitor
# ou avec Docker
make docker-up
```

## 📦 Structure du projet

```
CozyDoor/
├── app/
│   ├── monitorAll.js       # Surveillance multi-capteurs
│   ├── getDoorState.js     # Script de surveillance individuel
│   ├── getconf.js          # Script pour obtenir les infos d'un appareil
│   ├── tcp_client.js       # Client TCP pour communiquer avec les appareils
│   └── utils.js            # Fonctions utilitaires
├── Dockerfile              # Image Docker
├── docker-compose.yml      # Configuration Docker production
├── config.json.sample      # Exemple de configuration
├── package.json            # Dépendances Node.js
├── Makefile                # Commandes de gestion
└── README.md               # Ce fichier
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
