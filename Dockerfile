FROM python:3.11-slim

# Variables d'environnement pour éviter les prompts pip
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Copie du code source et des dépendances
COPY app/ ./app/
COPY requirements.txt .

# Installation des dépendances
RUN pip install --upgrade pip && pip install -r requirements.txt

# Commande par défaut (sera surchargée par docker-compose)
CMD ["python3", "app/getDoorState.py"]