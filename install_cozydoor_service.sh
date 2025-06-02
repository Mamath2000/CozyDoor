#!/bin/bash

# Usage: sudo ./install_cozydoor_service.sh <IP> <NOM_COMPOSANT> <FRIENDLY_NAME>

if [ "$EUID" -ne 0 ]; then
  echo "Merci de lancer ce script en tant que root (sudo)."
  exit 1
fi

if [ $# -ne 3 ]; then
  echo "Usage: sudo $0 <IP> <NOM_COMPOSANT> <FRIENDLY_NAME>"
  exit 1
fi

IP="$1"
NAME="$2"
FRIENDLY_NAME="$3"
USER="root"
WORKDIR="$PWD/app"
PYTHON="$WORKDIR/venv/bin/python3"

# 0. Apt update and install dependencies
apt update
apt install -y python3 python3-venv

# 1. Création de l'environnement virtuel et installation des dépendances
cd "$WORKDIR" || exit 1
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r ../requirements.txt
deactivate

# 2. Création du fichier de service systemd
SERVICE_FILE="/etc/systemd/system/cozydoor_$NAME.service"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Service CozyDoor - getDoorState
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$WORKDIR
ExecStart=$PYTHON $WORKDIR/getDoorState.py $IP $NAME "$FRIENDLY_NAME"
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# 3. Activation et démarrage du service
systemctl daemon-reload
systemctl enable cozydoor_$NAME.service
systemctl restart cozydoor_$NAME.service

echo "Service cozydoor installé et démarré."
echo "Vérifiez le statut avec : sudo systemctl status cozydoor_$NAME.service"