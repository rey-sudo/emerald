# bin/worker/Dockerfile
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# 1. Instalar dependencias primero (aprovecha el cache de capas de Docker)
# Copiamos solo el archivo de requerimientos
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2. Copiar solo el código fuente
# Evita copiar el Dockerfile y otros archivos innecesarios
COPY . .
# Si tienes más archivos de código, puedes usar:
# COPY bin/worker/*.py ./

CMD ["python", "main.py"]