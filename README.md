# CozyDoor

Capteurs d'ouverture Wi-Fi **CosyLife** (sur pile) intégrés à **Home Assistant** via MQTT, en local
(TCP 5555, sans cloud), avec la découverte automatique HA.

Les capteurs dorment et ne sont joignables que quelques secondes, ~10 s après une ouverture/fermeture :
CozyDoor les interroge toutes les 250 ms. Détails (mesures, protocole, topics, entités, exploitation) :
**[docs/cozydoor.md](docs/cozydoor.md)**.

## Démarrage rapide

```bash
make config            # config.json depuis config.json.sample, puis l'éditer (broker, capteurs à IP fixe)
make install           # dépendances (npm ci)
make monitor           # surveillance en local
```

En production : image `mathmath350/cozydoor`, voir `docker-compose.example.yml` (réseau `host` obligatoire,
`config.json` monté en lecture seule).

## Développement

| Commande | Rôle |
|---|---|
| `make test-getconf IP=…` | infos et état d'un capteur (pendant un réveil) |
| `make docker-up` / `docker-logs` / `docker-health` | container local (build) |
| `make docker-publish` | release : version +1, commit, image `latest` + version + ref git, tag `vX.Y.Z` |

`make help` liste toutes les cibles.

## Licence

MIT — Mamath
