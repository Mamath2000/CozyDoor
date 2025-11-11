# Utiliser une image Node.js officielle
FROM node:18-alpine

# Arguments de build pour les métadonnées
ARG GIT_REF=unknown
ARG BUILD_DATE=unknown
ARG VERSION=unknown

# Labels pour les métadonnées de l'image
LABEL org.opencontainers.image.title="CozyDoor" \
      org.opencontainers.image.description="Door sensor integration with Home Assistant via MQTT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${GIT_REF}" \
      org.opencontainers.image.authors="Mamath" \
      org.opencontainers.image.source="https://github.com/Mamath2000/CozyDoor"

# Installer les outils système nécessaires (ping, etc.)
RUN apk add --no-cache iputils

# Définir le répertoire de travail
WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le code source
COPY app/ ./app/

# Copier le fichier de configuration (sera remplacé par un volume)
COPY config.json.sample ./config.json.sample

# Créer un utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Commande par défaut
CMD ["node", "app/monitorAll.js"]
