#!/bin/bash
set -e

echo "🚀 Deploying Organizerr..."

if [ ! -d organizerr-frontend ]; then
  git clone https://github.com/Akshay-Kumar/organizerr-frontend.git
fi

if [ ! -d organizerr-backend ]; then
  git clone https://github.com/Akshay-Kumar/organizerr-backend.git
fi

if [ ! -d media-organizer ]; then
  git clone https://github.com/Akshay-Kumar/media-organizer.git
fi

docker compose down -v || true
docker compose up -d --build

echo "✅ Deployment complete"