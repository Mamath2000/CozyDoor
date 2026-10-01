#!/bin/bash

# Script de build et publication Docker pour CozyDoor.
# La version est incrémentée AVANT le build : l'image X.Y.Z contient exactement le commit "Release X.Y.Z"
# (package.json, label org.opencontainers.image.version, sw_version affichée dans Home Assistant).

set -e

# Configuration
DOCKER_USER=${DOCKER_USER:-"mathmath350"}
APP_NAME="cozydoor"

echo "🚀 Build et publication Docker pour $APP_NAME"
echo "👤 Utilisateur Docker Hub: $DOCKER_USER"

# Vérifications des prérequis
for cmd in jq docker git; do
    command -v $cmd >/dev/null 2>&1 || { echo "❌ $cmd est requis mais non installé."; exit 1; }
done

# Vérifier la connexion Docker Hub
if ! docker info 2>/dev/null | grep -q Username; then
    echo "❌ Non connecté à Docker Hub. Lancez 'docker login' d'abord."
    exit 1
fi

# Le working directory doit être propre : l'image doit correspondre à un commit
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Working directory non propre, commitez d'abord :"
    git status --short
    exit 1
fi

# Nouvelle version (patch + 1)
VERSION=$(jq -r '.version' package.json)
IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"
NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
echo "📦 Version : $VERSION → $NEW_VERSION"

# package.json + package-lock.json, puis commit de release (annulé si le build échoue)
npm version "$NEW_VERSION" --no-git-tag-version >/dev/null
trap 'echo "❌ Échec : version restaurée"; git checkout -- package.json package-lock.json' ERR
git add package.json package-lock.json
git commit -q -m "🔖 Release $NEW_VERSION"
trap - ERR
trap 'echo "❌ Échec du build/push : annuler le commit de release avec  git reset --hard HEAD~1"' ERR
GIT_REF=$(git rev-parse --short HEAD)
echo "🔀 Ref git: $GIT_REF"

# Build de l'image Docker
echo "🔨 Construction de l'image Docker..."
docker build \
    --build-arg VERSION="$NEW_VERSION" \
    --build-arg GIT_REF="$GIT_REF" \
    --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    -t "$DOCKER_USER/$APP_NAME:latest" \
    -t "$DOCKER_USER/$APP_NAME:$NEW_VERSION" \
    -t "$DOCKER_USER/$APP_NAME:$GIT_REF" \
    .

# Pousse les images sur Docker Hub
echo "📤 Publication sur Docker Hub..."
for tag in latest "$NEW_VERSION" "$GIT_REF"; do
    docker push -q "$DOCKER_USER/$APP_NAME:$tag"
done

git tag "v$NEW_VERSION"

echo ""
echo "✅ Version $NEW_VERSION publiée : $DOCKER_USER/$APP_NAME:{latest,$NEW_VERSION,$GIT_REF}"
echo "🔄 À pousser : git push origin main --tags"
