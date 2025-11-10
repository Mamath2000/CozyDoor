# Guide du développeur CozyDoor

## 📁 Structure du projet

```
CozyDoor/
├── app/                    # Code source principal
│   ├── getDoorState.js    # Service de surveillance des capteurs
│   ├── getconf.js         # Utilitaire de configuration
│   ├── tcp_client.js      # Client TCP pour CosyLife
│   └── utils.js           # Fonctions utilitaires
├── config.json.sample     # Exemple de configuration
├── .gitignore            # Fichiers ignorés par Git
├── .gitattributes        # Attributs Git
├── .npmignore            # Fichiers ignorés par npm
├── Makefile              # Commandes de développement
└── package.json          # Dépendances Node.js
```

## 🔧 Configuration de l'environnement de développement

### Installation initiale

```bash
# Cloner le dépôt
git clone https://github.com/Mamath2000/CozyDoor.git
cd CozyDoor

# Installer les dépendances
npm install

# Créer le fichier de configuration
cp config.json.sample config.json
nano config.json
```

### Fichiers à ne JAMAIS commiter

- `config.json` - Contient vos identifiants MQTT
- `node_modules/` - Dépendances (sera régénéré par npm)
- `package-lock.json` - Peut causer des conflits
- `.vscode/` - Configuration de votre éditeur

Ces fichiers sont déjà dans `.gitignore`.

## 🚀 Workflow de développement

### 1. Créer une branche de fonctionnalité

```bash
git checkout -b feature/ma-nouvelle-fonctionnalite
```

### 2. Développer et tester

```bash
# Tester votre code
make test-getconf IP=192.168.0.17

# Lancer en mode développement
make dev IP=192.168.0.17 NAME=test FRIENDLY_NAME="Test"
```

### 3. Vérifier avant de commiter

```bash
# Vérifier l'état du dépôt
git status

# Vérifier ce qui sera commité
git diff

# Ajouter les fichiers modifiés
git add app/getDoorState.js
git add Makefile

# Commiter avec un message clair
git commit -m "feat: ajout de la fonction XYZ"
```

### 4. Pousser et créer une Pull Request

```bash
git push origin feature/ma-nouvelle-fonctionnalite
```

## 📝 Conventions de commit

Utiliser les préfixes suivants :

- `feat:` - Nouvelle fonctionnalité
- `fix:` - Correction de bug
- `docs:` - Documentation
- `style:` - Formatage, point-virgules manquants, etc.
- `refactor:` - Refactorisation du code
- `test:` - Ajout de tests
- `chore:` - Maintenance, mise à jour des dépendances

Exemples :
```
feat: ajout de la prise en charge des capteurs de température
fix: correction du timeout de connexion TCP
docs: mise à jour du README avec les nouvelles commandes
refactor: simplification de la fonction _device_info
```

## 🧪 Tests

### Tester la connexion à un appareil

```bash
make test-getconf IP=192.168.0.17
```

### Tester en mode manuel

```bash
make run IP=192.168.0.17 NAME=test FRIENDLY_NAME="Test"
```

### Vérifier les dépendances

```bash
make check-deps
```

## 📦 Gestion des dépendances

### Ajouter une nouvelle dépendance

```bash
npm install <package-name>
git add package.json
git commit -m "chore: ajout de la dépendance <package-name>"
```

### Mettre à jour les dépendances

```bash
npm update
npm audit fix
```

## 🔍 Débogage

### Activer le mode debug

1. Éditer `config.json` :
```json
{
  "debug": true
}
```

2. Lancer l'application :
```bash
make dev IP=192.168.0.17 NAME=test FRIENDLY_NAME="Test"
```

### Vérifier les logs du service

```bash
make logs NAME=porte_entree
make logs-tail NAME=porte_entree
```

## 🔒 Sécurité

### Fichiers sensibles

- Ne JAMAIS commiter `config.json`
- Ne JAMAIS inclure de mots de passe ou tokens dans le code
- Utiliser des variables d'environnement pour les secrets

### Vérification avant commit

```bash
# Vérifier qu'aucun fichier sensible n'est ajouté
git status

# Vérifier le contenu qui sera commité
git diff --cached
```

## 📚 Ressources

- [Documentation Node.js](https://nodejs.org/docs/)
- [Documentation MQTT](https://mqtt.org/)
- [Home Assistant MQTT Discovery](https://www.home-assistant.io/integrations/mqtt/)

## 🤝 Contribution

1. Fork le projet
2. Créer une branche de fonctionnalité
3. Commiter vos changements
4. Pousser vers la branche
5. Ouvrir une Pull Request

## 💡 Bonnes pratiques

- ✅ Écrire du code clair et commenté
- ✅ Tester vos modifications avant de commiter
- ✅ Mettre à jour la documentation si nécessaire
- ✅ Utiliser des messages de commit descriptifs
- ✅ Respecter le style de code existant
- ❌ Ne pas commiter de fichiers de configuration locale
- ❌ Ne pas commiter de node_modules
- ❌ Ne pas commiter de logs ou fichiers temporaires
