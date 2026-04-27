#!/bin/bash
set -e

echo "🚀 Deploying Organizerr..."

# -------------------------------
# 1. Check Docker
# -------------------------------
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not installed"
  exit 1
fi

if docker compose version &> /dev/null; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

echo "🐳 Using: $COMPOSE_CMD"

# -------------------------------
# 2. Clone repos
# -------------------------------
if [ ! -d organizerr-frontend ]; then
  echo "📦 Cloning frontend..."
  git clone https://github.com/Akshay-Kumar/organizerr-frontend.git
else
  echo "🔄 Updating frontend..."
  cd organizerr-frontend && git pull && cd ..
fi

if [ ! -d organizerr-backend ]; then
  echo "📦 Cloning backend..."
  git clone https://github.com/Akshay-Kumar/organizerr-backend.git
else
  echo "🔄 Updating backend..."
  cd organizerr-backend && git pull && cd ..
fi

# -------------------------------
# 3. Ensure root .env exists
# -------------------------------
if [ ! -f ".env" ]; then
  echo "⚙️ Creating root .env..."

  cat <<EOF > .env
FRONTEND_PORT=3032
BACKEND_PORT=8005
WS_PORT=443
FRONTEND_URL=organizerr.beast-x.xyz
BACKEND_URL=organizerr-backend.beast-x.xyz
EOF
  echo "Please update .env before re-running"
  exit 1
fi

# -------------------------------
# 4. Load env (CRITICAL FIX)
# -------------------------------
echo "📄 Loading .env..."
set -a
source .env
set +a

# -------------------------------
# 5. Create backend.env
# -------------------------------
if [ ! -f "backend.env" ]; then
  echo "⚙️ Creating organizerr-backend/backend.env..."

  cat <<EOF > organizerr-backend/backend.env
TORRENT_CATEGORY=media-organizerr
DATABASE_URL=sqlite:///./data/torrents.db
UPLOAD_DIR=/app/uploads

QBT_HOST=http://192.168.2.200:8080
QBT_USER=*****
QBT_PASS=*****

QBT_POLL_RETRIES=10
QBT_POLL_DELAY=1

TMDB_API_KEY=*****

FILE_OPERATIONS_PATH=/config/file_operations.json
EOF
  echo "Please update organizerr-backend/backend.env before re-running"
  exit 1
fi

# -------------------------------
# 6. Create frontend .env
# -------------------------------
echo "⚙️ Creating organizerr-frontend/.env..."

cat <<EOF > organizerr-frontend/.env
REACT_APP_WS_HOST=${BACKEND_URL}
REACT_APP_WS_PORT=${WS_PORT}
REACT_APP_API_URL=https://${BACKEND_URL}
EOF

# -------------------------------
# 7. Ensure directories exist
# -------------------------------
mkdir -p backend_data
mkdir -p uploads

# -------------------------------
# 8. Start containers
# -------------------------------
echo "🐳 Starting containers..."

$COMPOSE_CMD down || true
$COMPOSE_CMD up -d --build

# -------------------------------
# 9. Wait + health check
# -------------------------------
echo "⏳ Waiting for services..."
sleep 15

echo "🔍 Checking backend..."
if curl -k -s "https://${BACKEND_URL}" > /dev/null; then
  echo "✅ Backend is reachable"
else
  echo "⚠️ Backend not reachable yet (SSL or startup delay)"
fi

echo "🔍 Checking frontend..."
if curl -k -s "https://${FRONTEND_URL}" > /dev/null; then
  echo "✅ Frontend is reachable"
else
  echo "⚠️ Frontend not reachable yet"
fi

# -------------------------------
# 10. Done
# -------------------------------
echo ""
echo "🎉 Deployment complete!"
echo "🌐 Frontend: https://${FRONTEND_URL}"
echo "🔧 Backend:  https://${BACKEND_URL}"