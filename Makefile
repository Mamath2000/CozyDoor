.PHONY: help install config test-getconf monitor clean docker-build docker-run docker-up docker-down docker-logs docker-restart docker-shell docker-health docker-clean docker-publish

# Couleurs pour l'affichage
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Affiche cette aide
	@echo "$(BLUE)CozyDoor - Makefile$(NC)  (doc : docs/cozydoor.md)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-16s$(NC) %s\n", $$1, $$2}'

install: ## Installe les dépendances Node.js (npm ci, versions du package-lock.json)
	npm ci

config: ## Crée config.json depuis config.json.sample (si absent)
	@if [ -f config.json ]; then echo "$(YELLOW)⚠ config.json existe déjà$(NC)"; \
	else cp config.json.sample config.json && echo "$(GREEN)✓ config.json créé, à éditer$(NC)"; fi

test-getconf: ## Infos et état d'un capteur, pendant un réveil (IP=…)
	@[ -n "$(IP)" ] || { echo "$(RED)✗ IP requise : make test-getconf IP=192.168.x.y$(NC)"; exit 1; }
	node app/getconf.js $(IP)

monitor: ## Lance la surveillance en local (config.json)
	@[ -f config.json ] || { echo "$(RED)✗ config.json absent (make config)$(NC)"; exit 1; }
	npm run monitor

clean: ## Supprime node_modules (le package-lock.json est versionné, on le garde)
	rm -rf node_modules

# ==============================================================================
# Docker
# ==============================================================================

docker-build: ## Construit l'image locale cozydoor:latest
	docker build -t cozydoor:latest .

docker-run: ## Lance l'image locale (réseau host, config.json monté)
	@[ -f config.json ] || { echo "$(RED)✗ config.json absent (make config)$(NC)"; exit 1; }
	docker run --rm --network host -v $(PWD)/config.json:/app/config.json:ro cozydoor:latest

docker-up: ## Lance avec docker compose (build local)
	@[ -f config.json ] || { echo "$(RED)✗ config.json absent (make config)$(NC)"; exit 1; }
	docker compose up -d --build

docker-down: ## Arrête docker compose
	docker compose down

docker-logs: ## Logs du container
	docker compose logs -f

docker-restart: ## Redémarre le container
	docker compose restart

docker-shell: ## Shell dans le container
	docker compose exec cozydoor sh

docker-health: ## État du health check et derniers résultats
	@docker inspect cozydoor --format '{{.State.Health.Status}}{{range .State.Health.Log}}{{"\n"}}  {{.ExitCode}} {{.Output}}{{end}}'

docker-clean: ## Supprime le container et l'image locale
	docker compose down -v
	docker rmi cozydoor:latest 2>/dev/null || true

docker-publish: ## Release : incrémente la version, commit, build et publie sur Docker Hub, tag git
	./build-docker-image.sh
