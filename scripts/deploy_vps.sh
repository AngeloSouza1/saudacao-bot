#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 <repo_git> [pasta_destino]"
  echo "Exemplo: $0 git@github.com:usuario/saudacao-bot.git /opt/saudacao-bot"
  exit 1
fi

REPO_URL="$1"
APP_DIR="${2:-/opt/saudacao-bot}"

echo "==> Instalando dependências de sistema (Ubuntu/Debian)..."
sudo apt update
sudo apt install -y git nginx curl

if ! command -v node >/dev/null 2>&1; then
  echo "==> Instalando Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> Instalando PM2..."
  sudo npm i -g pm2
fi

echo "==> Preparando pasta da aplicação: $APP_DIR"
sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER":"$USER" "$APP_DIR"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "==> Clonando repositório..."
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
echo "==> Instalando dependências do projeto..."
npm install

if [[ ! -f .env ]]; then
  cat > .env <<'EOF'
TZ=America/Sao_Paulo
DASHBOARD_HOST=127.0.0.1
DASHBOARD_PORT=3001
WHATSAPP_HEADLESS=true
DASHBOARD_AUTH_USER=admin
DASHBOARD_AUTH_PASSWORD=troque-por-uma-senha-forte
EOF
  echo "==> Arquivo .env criado. Edite antes de iniciar produção."
fi

echo "==> Subindo app com PM2..."
pm2 start ecosystem.config.cjs || pm2 restart saudacao-bot
pm2 save

echo
echo "Deploy base concluído."
echo "Próximo passo: configurar Nginx com proxy para 127.0.0.1:3001."
