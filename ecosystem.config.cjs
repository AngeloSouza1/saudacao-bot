module.exports = {
  apps: [
    {
      name: "saudacao-bot",
      script: "index.js",
      cwd: "/opt/saudacao-bot",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        TZ: "America/Sao_Paulo",
        DASHBOARD_HOST: "127.0.0.1",
        DASHBOARD_PORT: "3001",
        WHATSAPP_HEADLESS: "true"
      }
    }
  ]
};
