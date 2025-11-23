#!/bin/bash

# Script to build and push the image to Docker Hub
# Following the Oasis documentation: https://docs.oasis.io/build/rofl/workflow/containerize-app
# Usage: ./build-and-push.sh
# 

set -e

echo "🔨 Building Docker image using 'docker compose build'..."
docker compose build

echo "✅ Build completed successfully"

# Ask if you want to publish the image to Docker Hub
read -p "Do you want to publish the image to Docker Hub? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "📤 Pushing image to Docker Hub using 'docker compose push'..."
    
    docker compose push
    
    echo "✅ Image published successfully"
    echo "🔗 You can see it at: https://hub.docker.com/r/lucasmarctyd/eligibility-checker"
    echo ""
    
    docker images --digests
    
    echo "   Then you can pin it in compose.yaml adding @sha256:... to the image"
else
    echo "⏭️  Publication cancelled. The image is available locally."
fi

