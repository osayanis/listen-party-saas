#!/bin/bash
export DEBIAN_FRONTEND=noninteractive

echo "🔄 1/6 - Mise à jour du système..."
apt-get update && apt-get upgrade -y

echo "📦 2/6 - Installation de Nginx, Git et Curl..."
apt-get install -y curl git nginx

echo "🟢 3/6 - Installation de Node.js (v20) et PM2..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2

echo "📥 4/6 - Téléchargement du projet ListenParty..."
mkdir -p /var/www
cd /var/www

if [ -d "listen-party-saas" ]; then
    cd listen-party-saas
    git reset --hard HEAD
    git pull origin main
else
    git clone https://github.com/osayanis/listen-party-saas.git
    cd listen-party-saas
fi

echo "🏗️ 5/6 - Installation et Compilation..."
npm install
npm run build

echo "🚀 6/6 - Lancement de l'application et de Nginx..."
# Lancement de l'app avec PM2
pm2 start server.js --name "listenparty" || pm2 restart "listenparty"
pm2 save
pm2 startup systemd -u root --hp /root || true

# Configuration de Nginx
cat > /etc/nginx/sites-available/listenparty << 'EOF'
server {
    listen 80;
    server_name _; # Accepte l'IP directement

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Activation du site Nginx
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/listenparty /etc/nginx/sites-enabled/
systemctl restart nginx

echo ""
echo "✅ TERMINÉ ! Ton site ListenParty est en ligne."
echo "👉 Accède à ton application via http://141.11.103.154"
