---
id: cozydoor
title: CozyDoor
sidebar_label: CozyDoor
sidebar_position: 1
description: Capteurs d'ouverture Wi-Fi CosyLife (sur pile) intégrés à Home Assistant via MQTT.
---

## Rôle

CozyDoor interroge en local des **capteurs d'ouverture Wi-Fi CosyLife** (« Door magnet », sur pile) et publie
leur état sur MQTT avec la découverte automatique Home Assistant. Aucun cloud n'est nécessaire au fonctionnement
(l'API doiting ne sert qu'à afficher le nom du modèle, facultatif).

Image Docker `mathmath350/cozydoor`, un container par site, `network_mode: host`.

## Comportement des capteurs (mesuré le 2026-10-02)

Le capteur **dort** et n'allume son Wi-Fi qu'après un événement :

| Mesure | Valeur |
|---|---|
| Délai entre le geste (ouverture/fermeture) et le réveil | **10 à 13 s** (reconnexion Wi-Fi) |
| Durée pendant laquelle il est joignable | **0,4 à 12 s** |
| Première connexion TCP après le réveil | ~400 ms (les suivantes ~30 ms) |
| Connexions simultanées | acceptées |
| Envoi spontané de l'état sur une connexion ouverte | non observé |

Conséquences :

- l'état n'arrive dans HA qu'**une dizaine de secondes après** le geste, quoi qu'on fasse côté logiciel ;
- il faut interroger **souvent** et **sans attendre** : l'ancienne boucle (ping + 4 s d'attente + délai de
  connexion de 100 ms) ratait des événements ;
- un réveil très court (ouverture refermée aussitôt) reste à la limite : l'interrogation ne peut pas garantir
  de tout attraper.

## Protocole (TCP 5555)

JSON terminé par `\r\n`, un numéro de série `sn` (timestamp ms) relie la réponse à la requête.

| `cmd` | Requête | Réponse utile |
|---|---|---|
| `0` (info) | `{"pv":0,"cmd":0,"sn":"…","msg":{}}` | `msg.did` (id), `msg.pid` (modèle), `mac`, `rssi`, `sv` (firmware) |
| `2` (état) | `{"pv":0,"cmd":2,"sn":"…","msg":{"attr":[0]}}` | `msg.data` : `"7"` contact (1 = ouvert), `"9"` batterie ×10 (1000 = 100 %) |

Les réponses peuvent arriver fragmentées ou collées : elles sont lues ligne par ligne.

## Fonctionnement

- Une tentative de connexion **toutes les `probe_interval` ms** (250), sans attendre les précédentes,
  abandonnée après `connect_timeout` ms (1000). État lu d'abord, identité de l'appareil une seule fois.
- Une réponse plus ancienne n'écrase jamais un état plus récent ; un état incomplet (champ `7` ou `9` absent)
  est ignoré au lieu de publier un faux « fermé ».
- Publication de l'état **seulement s'il change** ; `last_seen` **une fois par réveil**.
- Republication de toutes les découvertes, puis (2 s après) des derniers états connus : à chaque connexion MQTT
  et à chaque **naissance de Home Assistant** (`online` non retenu sur `homeassistant/status`).
- Logs normaux : `Réveil`, `Contact: on|off, Batterie: n%`, `Endormi (éveillé ~x s)`. `"debug": true` pour le détail.

## Configuration (`config.json`)

```json
{
  "mqtt_host": "192.168.100.10",
  "mqtt_port": 1883,
  "base_topic": "CosyLife",
  "debug": false,
  "probe_interval": 250,
  "connect_timeout": 1000,
  "sensors": [
    { "name": "cozylife_1537", "friendly_name": "Fenêtre Bureau", "ip": "192.168.90.163", "enabled": true }
  ]
}
```

`polling_interval`, `connection_timeout` et `retry_delay` (anciennes versions) sont ignorés, avec un
avertissement au démarrage. Les capteurs doivent avoir une **IP fixe** (réservation DHCP).

## MQTT et Home Assistant

| Topic | Contenu | Retenu |
|---|---|---|
| `<base>/<name>` | `{"contact":"on","battery":100,"battery_low":"off","device_id":…,"ip":…}` | oui |
| `<base>/<name>/last_seen` | horodatage ISO 8601 du dernier réveil | oui |
| `<base>/monitor/lwt` | `online` / `offline` (LWT) | oui |
| `homeassistant/device/<name>/config` | découverte (format « device ») | oui |

Entités par capteur : contact (`binary_sensor`, door), batterie, alerte batterie (< 30 %), IP,
**dernier réveil** (`sensor.<name>_last_seen`, timestamp). Disponibilité = statut du moniteur.

Un capteur mort (pile vide, Wi-Fi perdu) ne se signale pas : surveiller `last_seen` dans HA
(alerte « pas vu depuis X jours »).

## Exploitation

| Action | Commande |
|---|---|
| Publier une nouvelle image | `make docker-publish` (dans le repo ; tag `latest` + version, puis incrémente `package.json`) |
| Déployer sur un site | `docker compose pull && docker compose up -d` dans le dossier du compose |
| Tester un capteur | `make test-getconf IP=<ip>` (pendant un réveil) |
| Logs | `docker logs -f cozydoor` |

Pour déboguer sans toucher à la prod : broker Mosquitto de dev sur dev-math (port 1883) avec un `base_topic` de test.
