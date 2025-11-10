# Commandes Make disponibles

## 🎯 Commandes principales

| Commande | Description | Exemple |
|----------|-------------|---------|
| `make help` | Affiche l'aide complète | `make help` |
| `make setup` | Installation complète initiale | `make setup` |
| `make install` | Installe les dépendances npm | `make install` |
| `make config` | Crée config.json | `make config` |
| `make test-getconf` | Teste la connexion | `make test-getconf IP=192.168.0.17` |
| `make run` | Lance en mode manuel | `make run IP=192.168.0.17 NAME=porte FRIENDLY_NAME="Porte"` |
| `make dev` | Lance en mode debug | `make dev IP=192.168.0.17 NAME=test FRIENDLY_NAME="Test"` |

## 🔧 Gestion des services

| Commande | Description | Exemple |
|----------|-------------|---------|
| `make install-service` | Installe un service systemd | `sudo make install-service IP=192.168.0.17 NAME=porte_entree FRIENDLY_NAME="Porte d'Entrée"` |
| `make uninstall-service` | Désinstalle un service | `sudo make uninstall-service NAME=porte_entree` |
| `make status` | Affiche le statut | `make status NAME=porte_entree` |
| `make restart` | Redémarre le service | `sudo make restart NAME=porte_entree` |
| `make logs` | Logs en temps réel | `make logs NAME=porte_entree` |
| `make logs-tail` | 50 dernières lignes | `make logs-tail NAME=porte_entree` |
| `make list-services` | Liste tous les services | `make list-services` |

## 🛠️ Utilitaires

| Commande | Description | Exemple |
|----------|-------------|---------|
| `make check-deps` | Vérifie les dépendances système | `make check-deps` |
| `make clean` | Nettoie node_modules | `make clean` |

## 📝 Variables configurables

Toutes les commandes supportent ces variables :

- **IP** : Adresse IP de l'appareil (défaut: `192.168.0.17`)
- **NAME** : Nom du composant (défaut: `porte_entree`)
- **FRIENDLY_NAME** : Nom convivial (défaut: `"Porte d'Entrée"`)

### Exemples d'utilisation :

```bash
# Avec les valeurs par défaut
make test-getconf

# Avec IP personnalisée
make test-getconf IP=192.168.1.50

# Avec toutes les variables
make run IP=192.168.1.50 NAME=garage FRIENDLY_NAME="Porte du Garage"
```

## 🚀 Workflows typiques

### 1. Première installation

```bash
make setup                    # Installation complète
nano config.json              # Éditer la config
make test-getconf IP=X.X.X.X  # Tester la connexion
```

### 2. Installation d'un nouveau capteur

```bash
# Test manuel d'abord
make run IP=192.168.0.20 NAME=fenetre_salon FRIENDLY_NAME="Fenêtre Salon"

# Si OK, installer comme service
sudo make install-service IP=192.168.0.20 NAME=fenetre_salon FRIENDLY_NAME="Fenêtre Salon"

# Vérifier
make status NAME=fenetre_salon
make logs-tail NAME=fenetre_salon
```

### 3. Dépannage d'un service

```bash
make status NAME=porte_entree          # Statut
make logs-tail NAME=porte_entree       # Derniers logs
sudo make restart NAME=porte_entree    # Redémarrer
make logs NAME=porte_entree            # Suivre les logs
```

### 4. Mise à jour du code

```bash
# Lister tous les services
make list-services

# Arrêter tous les services
sudo systemctl stop cozydoor_*.service

# Mettre à jour
git pull
make clean
make install

# Redémarrer
sudo systemctl start cozydoor_*.service
```

## 💡 Astuces

### Installer plusieurs capteurs d'un coup

Créez un script `install_all.sh` :

```bash
#!/bin/bash

# Porte d'entrée
sudo make install-service IP=192.168.0.17 NAME=porte_entree FRIENDLY_NAME="Porte d'Entrée"

# Porte garage
sudo make install-service IP=192.168.0.18 NAME=porte_garage FRIENDLY_NAME="Porte Garage"

# Fenêtre salon
sudo make install-service IP=192.168.0.19 NAME=fenetre_salon FRIENDLY_NAME="Fenêtre Salon"

# Fenêtre chambre
sudo make install-service IP=192.168.0.20 NAME=fenetre_chambre FRIENDLY_NAME="Fenêtre Chambre"
```

Puis exécutez :
```bash
chmod +x install_all.sh
./install_all.sh
```

### Voir les logs de tous les services

```bash
sudo journalctl -u 'cozydoor_*' -f
```

### Redémarrer tous les services

```bash
sudo systemctl restart cozydoor_*.service
```

### Vérifier le statut de tous les services

```bash
systemctl status 'cozydoor_*'
```
