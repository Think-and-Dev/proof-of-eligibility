#!/bin/bash

# Script para buildear y publicar la imagen a Docker Hub
# Siguiendo la documentación de Oasis: https://docs.oasis.io/build/rofl/workflow/containerize-app
# Uso: ./build-and-push.sh
# 

set -e

echo "🔨 Building Docker image usando 'docker compose build'..."
docker compose build

echo "✅ Build completado exitosamente"

# Preguntar si desea publicar
read -p "¿Deseas publicar la imagen a Docker Hub? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "📤 Publicando imagen a Docker Hub usando 'docker compose push'..."
    
    docker compose push
    
    echo "✅ Imagen publicada exitosamente"
    echo "🔗 Puedes verla en: https://hub.docker.com/r/lucasmarctyd/eligibility-checker"
    echo ""
    
    docker images --digests
    
    echo "   Luego puedes pinarlo en compose.yaml agregando @sha256:... a la imagen"
else
    echo "⏭️  Publicación cancelada. La imagen está disponible localmente."
fi

