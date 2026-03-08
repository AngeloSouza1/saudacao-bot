#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/opt/saudacao-bot}"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "Pasta não parece um repositório git: $APP_DIR"
  exit 1
fi

cd "$APP_DIR"
echo "==> Atualizando código..."
git pull --ff-only

echo "==> Atualizando dependências..."
npm install

echo "==> Reiniciando aplicação..."
pm2 restart saudacao-bot

echo "Atualização concluída."
