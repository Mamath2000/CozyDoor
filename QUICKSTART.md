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

## 🐳 Déploiement avec Docker (production recommandée)

```bash
# 1. Construire l'image
make docker-build

# 2. Configurer vos capteurs dans config.json
nano config.json

# 3. Lancer en arrière-plan
make docker-up

# 4. Vérifier les logs
make docker-logs

# 5. Arrêter
make docker-down
```

## 📊 Commandes de gestion Docker

### Voir les logs
```bash
# Temps réel (Ctrl+C pour quitter)
make docker-logs

# Redémarrer le container
make docker-restart
```

### Gestion avancée
```bash
# Shell dans le container
make docker-shell

# Nettoyer complètement
make docker-clean
```

## 🏠 Exemple avec plusieurs capteurs

Éditez `config.json` :

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
    },
    {
      "ip": "192.168.0.19",
      "name": "fenetre_salon",
      "friendly_name": "Fenêtre Salon"
    }
  ]
}
```

Puis lancez :
```bash
make docker-up
# ou en local
make monitor
```

## 🔍 Résolution de problèmes
