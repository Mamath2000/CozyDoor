# Guide de démarrage rapide CozyDoor

## 🚀 Installation initiale (une seule fois)

```bash
# 1. Installation complète
make setup

# 2. Éditer la configuration MQTT
nano config.json
```

## 🧪 Test de connexion

```bash
# Tester la connexion à votre appareil
make test-getconf IP=192.168.0.17
```

**Sortie attendue :**
```
- ip: 192.168.0.17
  did: 629168597cb94c4c1d8f
  pid: e2s64v
  dmn: Door Sensor
  ...
```

## 🏃 Exécution en mode manuel (développement)

```bash
# Lancer le monitoring d'un capteur
make run IP=192.168.0.17 NAME=porte_entree FRIENDLY_NAME="Porte d'Entrée"
```

**Pour arrêter :** `Ctrl+C`

## 🔧 Installation comme service (production)

```bash
# Installer le service
sudo make install-service IP=192.168.0.17 NAME=porte_entree FRIENDLY_NAME="Porte d'Entrée"

# Vérifier que ça fonctionne
make status NAME=porte_entree

# Voir les logs en temps réel
make logs NAME=porte_entree
```

## 📊 Commandes de gestion courantes

### Vérifier le statut
```bash
make status NAME=porte_entree
```

### Redémarrer le service
```bash
sudo make restart NAME=porte_entree
```

### Voir les logs
```bash
# Temps réel (Ctrl+C pour quitter)
make logs NAME=porte_entree

# Dernières 50 lignes
make logs-tail NAME=porte_entree
```

### Désinstaller un service
```bash
sudo make uninstall-service NAME=porte_entree
```

## 🏠 Exemple avec plusieurs capteurs

```bash
# Porte d'entrée
sudo make install-service IP=192.168.0.17 NAME=porte_entree FRIENDLY_NAME="Porte d'Entrée"

# Porte du garage
sudo make install-service IP=192.168.0.18 NAME=porte_garage FRIENDLY_NAME="Porte Garage"

# Fenêtre salon
sudo make install-service IP=192.168.0.19 NAME=fenetre_salon FRIENDLY_NAME="Fenêtre Salon"

# Voir tous les services
make list-services
```

## 🐛 Dépannage

### Vérifier les dépendances
```bash
make check-deps
```

### Mode debug
1. Éditer `config.json` et mettre `"debug": true`
2. Lancer : `make dev IP=192.168.0.17 NAME=test FRIENDLY_NAME="Test"`

### Erreur "device not found"
- Vérifier que l'IP est correcte
- Vérifier que l'appareil est sur le même réseau
- Tester avec ping : `ping 192.168.0.17`

### Service ne démarre pas
```bash
# Voir les erreurs
make logs-tail NAME=porte_entree

# Vérifier le fichier de config
cat config.json

# Tester manuellement
make run IP=192.168.0.17 NAME=porte_entree FRIENDLY_NAME="Test"
```

## 🔄 Mise à jour

```bash
# Arrêter tous les services
sudo systemctl stop cozydoor_*.service

# Mettre à jour le code (git pull, etc.)

# Réinstaller les dépendances
make clean
make install

# Redémarrer les services
sudo systemctl start cozydoor_*.service
```

## 📋 Configuration MQTT typique

**config.json :**
```json
{
  "mqtt_host": "192.168.0.100",
  "mqtt_port": 1883,
  "base_topic": "CosyLife",
  "debug": false
}
```

**Avec Home Assistant :**
- Les appareils apparaissent automatiquement dans Home Assistant
- Topic MQTT : `CosyLife/<nom_composant>`
- Découverte automatique : `homeassistant/device/<nom_composant>/config`

## ℹ️ Aide complète

```bash
make help
```
