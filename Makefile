.PHONY: help install config test-getconf monitor clean

# Variables par défaut
IP ?= 192.168.0.17
NAME ?= porte_entree
FRIENDLY_NAME ?= "Porte d'Entrée"

# Couleurs pour l'affichage
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Affiche cette aide
	@echo "$(BLUE)CozyDoor - Makefile$(NC)"
	@echo ""
	@echo "$(GREEN)Commandes disponibles:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)Variables configurables:$(NC)"
	@echo "  $(YELLOW)IP$(NC)             Adresse IP de l'appareil (défaut: 192.168.0.17)"
	@echo "  $(YELLOW)NAME$(NC)           Nom du composant (défaut: porte_entree)"
	@echo "  $(YELLOW)FRIENDLY_NAME$(NC)  Nom convivial (défaut: \"Porte d'Entrée\")"
	@echo ""
	@echo "$(GREEN)Exemples:$(NC)"
	@echo "  make install"
	@echo "  make config"
	@echo "  make monitor                    # Surveiller tous les capteurs du config.json"
	@echo "  make test-getconf IP=192.168.0.18"
	@echo "  make docker-up                  # Lancer avec Docker"
	@echo ""

install: ## Installe les dépendances Node.js
	@echo "$(BLUE)Installation des dépendances...$(NC)"
	npm install
	@echo "$(GREEN)✓ Dépendances installées avec succès$(NC)"

config: ## Crée le fichier config.json depuis le template
	@if [ -f config.json ]; then \
		echo "$(YELLOW)⚠ config.json existe déjà$(NC)"; \
		read -p "Voulez-vous le remplacer? (y/N) " confirm; \
		if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
			cp config.json.sample config.json; \
			echo "$(GREEN)✓ config.json créé$(NC)"; \
			echo "$(YELLOW)→ Éditez maintenant config.json avec vos paramètres$(NC)"; \
		fi \
	else \
		cp config.json.sample config.json; \
		echo "$(GREEN)✓ config.json créé$(NC)"; \
		echo "$(YELLOW)→ Éditez maintenant config.json avec vos paramètres$(NC)"; \
	fi

test-getconf: ## Teste la connexion à un appareil (usage: make test-getconf IP=192.168.0.17)
	@echo "$(BLUE)Test de connexion à $(IP)...$(NC)"
	node app/getconf.js $(IP)


clean: ## Nettoie les dépendances et fichiers générés


clean: ## Nettoie les fichiers temporaires et node_modules
	@echo "$(BLUE)Nettoyage...$(NC)"
	rm -rf node_modules
	rm -f package-lock.json
	@echo "$(GREEN)✓ Nettoyage effectué$(NC)"

check-deps: ## Vérifie si les dépendances système sont installées
	@echo "$(BLUE)Vérification des dépendances système...$(NC)"
	@command -v node >/dev/null 2>&1 && echo "$(GREEN)✓ Node.js installé: $$(node --version)$(NC)" || echo "$(RED)✗ Node.js non installé$(NC)"
	@command -v npm >/dev/null 2>&1 && echo "$(GREEN)✓ npm installé: $$(npm --version)$(NC)" || echo "$(RED)✗ npm non installé$(NC)"
	@command -v ping >/dev/null 2>&1 && echo "$(GREEN)✓ ping disponible$(NC)" || echo "$(RED)✗ ping non disponible$(NC)"
	@command -v mosquitto_pub >/dev/null 2>&1 && echo "$(GREEN)✓ mosquitto-clients installé$(NC)" || echo "$(YELLOW)⚠ mosquitto-clients non installé (optionnel)$(NC)"

setup: install config ## Installation complète (dépendances + configuration)
	@echo ""
	@echo "$(GREEN)✓ Installation complète terminée!$(NC)"
	@echo ""
	@echo "$(BLUE)Prochaines étapes:$(NC)"
	@echo "  1. Éditez config.json avec vos paramètres MQTT"
	@echo "  2. Testez la connexion: make test-getconf IP=<votre_ip>"
	@echo ""


# ==============================================================================
# Commandes Docker
# ==============================================================================

docker-build: ## Construit l'image Docker
	@echo "$(BLUE)Construction de l'image Docker...$(NC)"
	docker build -t cozydoor:latest .
	@echo "$(GREEN)✓ Image Docker construite$(NC)"

docker-run: ## Lance le container Docker (mode host)
	@if [ ! -f config.json ]; then \
		echo "$(RED)✗ config.json n'existe pas$(NC)"; \
		echo "$(YELLOW)→ Exécutez 'make config' d'abord$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Lancement du container Docker...$(NC)"
	docker run --rm --network host -v $(PWD)/config.json:/app/config.json:ro cozydoor:latest
	@echo "$(GREEN)✓ Container arrêté$(NC)"

docker-up: ## Lance avec docker-compose
	@if [ ! -f config.json ]; then \
		echo "$(RED)✗ config.json n'existe pas$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Démarrage avec docker-compose...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ Container démarré$(NC)"
	@echo "$(YELLOW)→ Utilisez 'make docker-logs' pour voir les logs$(NC)"

docker-down: ## Arrête docker-compose
	@echo "$(BLUE)Arrêt du container...$(NC)"
	docker-compose down
	@echo "$(GREEN)✓ Container arrêté$(NC)"

docker-logs: ## Affiche les logs du container Docker
	docker-compose logs -f

docker-restart: ## Redémarre le container Docker
	@echo "$(BLUE)Redémarrage du container...$(NC)"
	docker-compose restart
	@echo "$(GREEN)✓ Container redémarré$(NC)"

docker-dev: ## Lance en mode développement avec docker-compose
	@if [ ! -f config.json ]; then \
		echo "$(RED)✗ config.json n'existe pas$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Démarrage en mode développement...$(NC)"
	docker-compose -f docker-compose.dev.yml up

docker-clean: ## Nettoie les images et containers Docker
	@echo "$(BLUE)Nettoyage Docker...$(NC)"
	docker-compose down -v
	docker rmi cozydoor:latest 2>/dev/null || true
	@echo "$(GREEN)✓ Nettoyage terminé$(NC)"

docker-shell: ## Ouvre un shell dans le container
	docker-compose exec cozydoor sh

docker-publish: ## Build et publie l'image sur Docker Hub (incrémente la version)
	@echo "$(BLUE)Build et publication Docker...$(NC)"
	@if [ ! -x build-docker-image.sh ]; then \
		chmod +x build-docker-image.sh; \
	fi
	./build-docker-image.sh
	@echo "$(GREEN)✓ Publication terminée$(NC)"

monitor: ## Surveille tous les capteurs configurés dans config.json
	@if [ ! -f config.json ]; then \
		echo "$(RED)✗ config.json n'existe pas$(NC)"; \
		echo "$(YELLOW)→ Exécutez 'make config' d'abord$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Lancement du monitoring multi-capteurs...$(NC)"
	@echo "$(YELLOW)Configuration : config.json$(NC)"
	@echo ""
	npm run monitor

	@if [ "$(shell id -u)" != "0" ]; then \
		echo "$(RED)✗ Cette commande nécessite les droits root$(NC)"; \
		echo "$(YELLOW)→ Utilisez: sudo make monitor-restart$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Redémarrage du service cozydoor-monitor...$(NC)"
	systemctl restart cozydoor-monitor.service
	@echo "$(GREEN)✓ Service redémarré$(NC)"
