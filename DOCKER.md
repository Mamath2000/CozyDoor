# 🐳 Guide Docker - CozyDoor

## 📋 Prérequis

- Docker installé
- Docker Compose installé
- Fichier `config.json` configuré

## 🚀 Démarrage rapide

### 1. Construire l'image

```bash
make docker-build
```

### 2. Configurer

```bash
# Créer config.json si nécessaire
make config
nano config.json
```

### 3. Lancer

```bash
# Avec docker compose (recommandé)
make docker-up

# Ou directement avec Docker
make docker-run
```

## 📊 Commandes disponibles

| Commande | Description |
|----------|-------------|
| `make docker-build` | Construit l'image Docker |
| `make docker-up` | Démarre avec docker compose (en arrière-plan) |
| `make docker-down` | Arrête le container |
| `make docker-logs` | Affiche les logs en temps réel |
| `make docker-restart` | Redémarre le container |
| `make docker-dev` | Mode développement avec hot reload |
| `make docker-clean` | Nettoie tout (images, containers, volumes) |
| `make docker-shell` | Ouvre un shell dans le container |
| `make docker-health` | Vérifie le health check du container |
| `make docker-publish` | Build et publie sur Docker Hub (auto-increment version) |

## 🏥 Health Check

Le container dispose d'un **health check** automatique qui vérifie :
- ✅ Le processus Node.js est actif
- ✅ La connexion au broker MQTT fonctionne

### Vérifier le statut

```bash
# Avec Make
make docker-health

# Ou directement
docker ps --format "table {{.Names}}\t{{.Status}}"
docker inspect cozydoor | jq '.[0].State.Health'
```

### Résultats possibles

- **healthy** ✅ : Tout fonctionne correctement
- **unhealthy** ❌ : Problème détecté (processus arrêté ou MQTT injoignable)
- **starting** ⏳ : En cours de démarrage (40s de grace period)

Le health check s'exécute toutes les 30 secondes avec un timeout de 10s.

## 🚀 Publication sur Docker Hub

### Configuration

Définissez votre nom d'utilisateur Docker Hub :

```bash
export DOCKER_USER="votre-username"
```

Ou modifiez directement dans `build-docker-image.sh` :

```bash
DOCKER_USER=${DOCKER_USER:-"votre-username"}
```

### Connexion à Docker Hub

```bash
docker login
```

### Build et publication automatique

```bash
make docker-publish
```

Ce script va :
1. ✅ Vérifier les prérequis (jq, docker, git)
2. 🔨 Construire l'image avec les métadonnées (version, git ref, build date)
3. 🏷️ Créer les tags : `latest`, `version`, `git-hash`
4. 📤 Pousser les images sur Docker Hub
5. 🔢 Incrémenter automatiquement la version dans `package.json`
6. 💾 Créer un commit git avec la nouvelle version

### Tags créés

```
votre-username/cozydoor:latest       # Dernière version
votre-username/cozydoor:1.0.0        # Version spécifique
votre-username/cozydoor:a1b2c3d      # Hash git court
```

### Installation des prérequis

```bash
# Installer jq (requis pour le script)
sudo apt install jq

# Se connecter à Docker Hub
docker login
```

## 🔧 Mode réseau : `host` (OBLIGATOIRE)

### Pourquoi `host` ?

Le programme **DOIT** utiliser `--network host` pour :

1. ✅ **Scanner le réseau local** - Détecter les appareils par IP
2. ✅ **Communiquer en TCP** - Port 5555 avec les capteurs CosyLife
3. ✅ **Faire des pings** - Vérifier la disponibilité des appareils
4. ✅ **Se connecter au broker MQTT** - Sur le réseau local

### Configuration dans docker-compose.yml

```yaml
services:
  cozydoor:
    network_mode: host  # ← OBLIGATOIRE !
```

### ⚠️ Limitations du mode `host`

- **Linux uniquement** - Le mode `host` ne fonctionne pas sur macOS/Windows Desktop
- **Sécurité** - Le container partage la stack réseau de l'hôte
- **Ports exposés** - Tous les ports du container sont accessibles sur l'hôte

## 🔒 Sécurité

### Utilisateur non-root

Le Dockerfile crée un utilisateur `nodejs` (UID 1001) :

```dockerfile
USER nodejs
```

### Fichier de configuration en lecture seule

```yaml
volumes:
  - ./config.json:/app/config.json:ro  # :ro = read-only
```

## 📝 Exemples d'utilisation

### Production

```bash
# Démarrer
make docker-up

# Voir les logs
make docker-logs

# Redémarrer après modification de config.json
make docker-restart

# Arrêter
make docker-down
```

### Développement

```bash
# Mode développement avec hot reload
make docker-dev
```

### Débogage

```bash
# Voir les logs
docker compose logs --tail=100 cozydoor

# Ouvrir un shell dans le container
make docker-shell

# Vérifier l'état
docker compose ps

# Inspecter le réseau
docker exec cozydoor-dev ip addr
docker exec cozydoor-dev ping -c 1 192.168.0.17
```

## 🏗️ Structure Docker

### Dockerfile

```dockerfile
FROM node:18-alpine
RUN apk add --no-cache iputils  # Pour ping
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY app/ ./app/
USER nodejs
CMD ["node", "app/monitorAll.js"]
```

### docker-compose.yml (Production)

```yaml
version: '3.8'
services:
  cozydoor:
    build: .
    container_name: cozydoor
    network_mode: host
    restart: unless-stopped
    volumes:
      - ./config.json:/app/config.json:ro
```

### docker-compose.dev.yml (Développement)

```yaml
version: '3.8'
services:
  cozydoor:
    build: .
    container_name: cozydoor-dev
    network_mode: host
    volumes:
      - ./config.json:/app/config.json:ro
      - ./app:/app/app:ro  # Hot reload
```

## 🔍 Vérification du réseau

### Tester que le container peut scanner le réseau

```bash
# Entrer dans le container
docker exec -it cozydoor sh

# Tester le ping
ping -c 1 192.168.0.17

# Tester la connexion TCP
nc -zv 192.168.0.17 5555

# Vérifier la route réseau
ip route
```

## 🐛 Dépannage

### Problème : "Cannot scan network"

**Cause** : Mode réseau bridge au lieu de host

**Solution** :
```yaml
network_mode: host  # Vérifier dans docker-compose.yml
```

### Problème : "Connection timeout"

**Cause** : Firewall ou réseau isolé

**Solution** :
```bash
# Vérifier que l'hôte peut ping l'appareil
ping 192.168.0.17

# Vérifier les règles iptables
sudo iptables -L
```

### Problème : "Config file not found"

**Cause** : Volume non monté correctement

**Solution** :
```bash
# Vérifier le chemin absolu
ls -la $(pwd)/config.json

# Recréer le container
make docker-down
make docker-up
```

### Problème : Logs ne s'affichent pas

**Solution** :
```bash
# Logs en temps réel
docker compose logs -f

# Dernières 100 lignes
docker compose logs --tail=100

# Logs d'un container spécifique
docker logs cozydoor
```

## 📦 Déploiement

### Sur un Raspberry Pi / Server Linux

```bash
# 1. Cloner le dépôt
git clone https://github.com/Mamath2000/CozyDoor.git
cd CozyDoor

# 2. Configurer
cp config.json.sample config.json
nano config.json

# 3. Construire et démarrer
make docker-build
make docker-up

# 4. Vérifier
make docker-logs
```

### Auto-démarrage au boot

Docker Compose avec `restart: unless-stopped` démarre automatiquement le container au démarrage du système.

```yaml
restart: unless-stopped  # Déjà configuré dans docker-compose.yml
```

## 🔄 Mise à jour

```bash
# 1. Arrêter le container
make docker-down

# 2. Mettre à jour le code
git pull

# 3. Reconstruire l'image
make docker-build

# 4. Redémarrer
make docker-up
```

## 📊 Monitoring

### Voir l'utilisation des ressources

```bash
docker stats cozydoor
```

### Voir les logs avec rotation

Les logs sont automatiquement limités :
- Max 10 MB par fichier
- 3 fichiers conservés

Configuration dans `docker-compose.yml` :
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## ⚙️ Variables d'environnement (optionnel)

Vous pouvez surcharger la config via des variables d'environnement :

```yaml
environment:
  - NODE_ENV=production
  - MQTT_HOST=192.168.0.100
  - MQTT_PORT=1883
```

Puis modifier le code pour lire ces variables.

## 🌐 Accès depuis d'autres machines

Avec `network_mode: host`, le service MQTT et les capteurs doivent être sur le **même réseau** que l'hôte Docker.

Si vous voulez isoler davantage, utilisez un réseau bridge personnalisé (mais vous perdrez la capacité de scanner le réseau local).
