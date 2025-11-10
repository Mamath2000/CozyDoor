.PHONY: help install config test-getconf run install-service uninstall-service status restart logs clean

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
	@echo "  make test-getconf IP=192.168.0.18"
	@echo "  make run IP=192.168.0.17 NAME=garage FRIENDLY_NAME=\"Porte Garage\""
	@echo "  make install-service IP=192.168.0.17 NAME=porte_entree FRIENDLY_NAME=\"Porte d'Entrée\""
	@echo "  make status NAME=porte_entree"
	@echo "  make logs NAME=porte_entree"
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

run: ## Lance getDoorState en mode manuel (usage: make run IP=... NAME=... FRIENDLY_NAME=...)
	@if [ ! -f config.json ]; then \
		echo "$(RED)✗ config.json n'existe pas$(NC)"; \
		echo "$(YELLOW)→ Exécutez 'make config' d'abord$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Lancement de getDoorState...$(NC)"
	@echo "$(YELLOW)IP: $(IP)$(NC)"
	@echo "$(YELLOW)Nom: $(NAME)$(NC)"
	@echo "$(YELLOW)Nom convivial: $(FRIENDLY_NAME)$(NC)"
	@echo ""
	node app/getDoorState.js $(IP) $(NAME) $(FRIENDLY_NAME)

install-service: ## Installe le service systemd (usage: sudo make install-service IP=... NAME=... FRIENDLY_NAME=...)
	@if [ "$(shell id -u)" != "0" ]; then \
		echo "$(RED)✗ Cette commande nécessite les droits root$(NC)"; \
		echo "$(YELLOW)→ Utilisez: sudo make install-service IP=... NAME=... FRIENDLY_NAME=...$(NC)"; \
		exit 1; \
	fi
	@if [ ! -f config.json ]; then \
		echo "$(RED)✗ config.json n'existe pas$(NC)"; \
		echo "$(YELLOW)→ Exécutez 'make config' d'abord$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Installation du service cozydoor_$(NAME)...$(NC)"
	./install_cozydoor_service.sh $(IP) $(NAME) $(FRIENDLY_NAME)
	@echo "$(GREEN)✓ Service installé avec succès$(NC)"
	@echo "$(YELLOW)→ Utilisez 'make status NAME=$(NAME)' pour vérifier$(NC)"

uninstall-service: ## Désinstalle le service systemd (usage: sudo make uninstall-service NAME=...)
	@if [ "$(shell id -u)" != "0" ]; then \
		echo "$(RED)✗ Cette commande nécessite les droits root$(NC)"; \
		echo "$(YELLOW)→ Utilisez: sudo make uninstall-service NAME=...$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Désinstallation du service cozydoor_$(NAME)...$(NC)"
	systemctl stop cozydoor_$(NAME).service || true
	systemctl disable cozydoor_$(NAME).service || true
	rm -f /etc/systemd/system/cozydoor_$(NAME).service
	systemctl daemon-reload
	@echo "$(GREEN)✓ Service désinstallé$(NC)"

status: ## Affiche le statut du service (usage: make status NAME=...)
	@echo "$(BLUE)Statut du service cozydoor_$(NAME):$(NC)"
	@systemctl status cozydoor_$(NAME).service || echo "$(RED)Service non trouvé$(NC)"

restart: ## Redémarre le service (usage: sudo make restart NAME=...)
	@if [ "$(shell id -u)" != "0" ]; then \
		echo "$(RED)✗ Cette commande nécessite les droits root$(NC)"; \
		echo "$(YELLOW)→ Utilisez: sudo make restart NAME=...$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Redémarrage du service cozydoor_$(NAME)...$(NC)"
	systemctl restart cozydoor_$(NAME).service
	@echo "$(GREEN)✓ Service redémarré$(NC)"

logs: ## Affiche les logs du service (usage: make logs NAME=...)
	@echo "$(BLUE)Logs du service cozydoor_$(NAME):$(NC)"
	@echo "$(YELLOW)(Ctrl+C pour quitter)$(NC)"
	@journalctl -u cozydoor_$(NAME).service -f

logs-tail: ## Affiche les dernières lignes des logs (usage: make logs-tail NAME=...)
	@echo "$(BLUE)Dernières logs du service cozydoor_$(NAME):$(NC)"
	@journalctl -u cozydoor_$(NAME).service -n 50 --no-pager

list-services: ## Liste tous les services CozyDoor installés
	@echo "$(BLUE)Services CozyDoor installés:$(NC)"
	@systemctl list-units --type=service --all | grep cozydoor || echo "$(YELLOW)Aucun service trouvé$(NC)"

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
	@echo "  3. Testez manuellement: make run IP=<votre_ip> NAME=<nom> FRIENDLY_NAME=<nom_convivial>"
	@echo "  4. Installez comme service: sudo make install-service IP=<votre_ip> NAME=<nom> FRIENDLY_NAME=<nom_convivial>"
	@echo ""

dev: ## Lance en mode développement avec logs debug
	@echo "$(BLUE)Mode développement (debug activé)$(NC)"
	@if [ ! -f config.json ]; then \
		echo "$(RED)✗ config.json n'existe pas$(NC)"; \
		exit 1; \
	fi
	@echo "Vérifiez que debug:true est dans config.json"
	node app/getDoorState.js $(IP) $(NAME) $(FRIENDLY_NAME)
