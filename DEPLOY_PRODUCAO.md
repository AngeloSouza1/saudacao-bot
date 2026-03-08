# Deploy em Produção (VPS Ubuntu + PM2 + Nginx)

Este projeto usa `whatsapp-web.js` + sessão local (`.wwebjs_auth`).  
Para produção, use **VPS Linux** (não serverless).

## 1) Preparar servidor

```bash
sudo apt update
sudo apt install -y git nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

## 2) Publicar código

```bash
sudo mkdir -p /opt/saudacao-bot
sudo chown -R $USER:$USER /opt/saudacao-bot
cd /opt/saudacao-bot
git clone <SEU_REPO_GIT> .
npm install
```

## 3) Configurar `.env`

Exemplo mínimo:

```env
TZ=America/Sao_Paulo
DASHBOARD_HOST=127.0.0.1
DASHBOARD_PORT=3001
WHATSAPP_HEADLESS=true
DASHBOARD_AUTH_USER=admin
DASHBOARD_AUTH_PASSWORD=troque-por-uma-senha-forte
NODE_VERSION=20
```

Se já usa outras variáveis (token, phone, etc), mantenha no `.env`.

## 4) Subir com PM2

Use o arquivo `ecosystem.config.cjs` deste projeto.

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 5) Configurar Nginx (proxy reverso)

Crie o site:

```bash
sudo nano /etc/nginx/sites-available/saudacao-bot
```

Conteúdo:

```nginx
server {
    listen 80;
    server_name SEU_DOMINIO_OU_IP;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ativar:

```bash
sudo ln -s /etc/nginx/sites-available/saudacao-bot /etc/nginx/sites-enabled/saudacao-bot
sudo nginx -t
sudo systemctl restart nginx
```

## 6) HTTPS (recomendado)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d SEU_DOMINIO
```

## 7) Primeiro login do WhatsApp (QR)

1. Acesse o painel via domínio.
2. Gere/escaneie o QR.
3. A sessão ficará salva em `.wwebjs_auth` no servidor.

## Atualização da aplicação

```bash
cd /opt/saudacao-bot
git pull
npm install
pm2 restart saudacao-bot
```

## Backup essencial

Faça backup destes arquivos/pastas:

- `.wwebjs_auth/`
- `config.json`
- `settings.json`
- `state.json`
- `cycles.json`
- `last-run.json`

Sem `.wwebjs_auth`, terá que escanear QR novamente.

---

# Deploy no Render (sem domínio próprio)

## 1) Suba o projeto para o GitHub

No seu computador:

```bash
git init
git add .
git commit -m "deploy render"
git branch -M main
git remote add origin <URL_DO_REPO>
git push -u origin main
```

## 2) Crie o serviço no Render

1. Acesse Render e clique em **New +** -> **Web Service**.
2. Conecte seu repositório GitHub.
3. Configure:
   - Runtime: **Node**
   - Build command: `npm run render-build`
   - Start command: `npm start`

## 3) Variáveis de ambiente (Render)

No painel do serviço, em **Environment**:

```env
TZ=America/Sao_Paulo
WHATSAPP_HEADLESS=true
DASHBOARD_AUTH_USER=admin
DASHBOARD_AUTH_PASSWORD=troque-por-uma-senha-forte
```

Observações:
- Não precisa definir `DASHBOARD_HOST` no Render.
- A porta é injetada automaticamente por `PORT` (já suportado no código).

## 4) Primeiro acesso

1. Abra a URL pública do Render (`https://...onrender.com`).
2. Faça login (Basic Auth).
3. Escaneie o QR do WhatsApp.

Se já tentou deploy antes sem Chrome:
- Execute **Manual Deploy -> Clear build cache & deploy**.

## 5) Limitação importante no plano gratuito

No gratuito, o disco é efêmero. A sessão `.wwebjs_auth` pode ser perdida em reinícios/deploy e será necessário escanear QR novamente.
