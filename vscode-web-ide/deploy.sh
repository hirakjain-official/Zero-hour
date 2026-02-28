#!/bin/bash

# VS Code Web IDE - Ubuntu EC2 Deployment Script
# Optimized for t3.small instances (2GB RAM).
# Automatically configures Swap, Nginx, Docker, & Node.js

echo "========================================================"
echo "🚀 Starting Deployment of Sandboxed VS Code Web IDE"
echo "========================================================"

# 1. ADD SWAP MEMORY (Critical for t3.small/2GB RAM)
echo "📦 Checking Swap space..."
if free | awk '/^Swap:/ {exit !$2}'; then
    echo "Swap already exists."
else
    echo "Adding 2GB Swap file for Docker container headroom..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "Swap space added."
fi

# 2. INSTALL SYSTEM DEPENDENCIES
echo "🛠️ Installing dependencies (Nginx, Docker, Node.js)..."
sudo apt update && sudo apt upgrade -y

# Docker
if ! command -v docker &> /dev/null; then
    sudo apt install -y docker.io docker-compose-v2
    sudo usermod -aG docker ubuntu
    sudo systemctl enable docker
    sudo systemctl start docker
fi

# Node.js 20 LTS
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Nginx
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
fi

# PM2
sudo npm install -g pm2

# 3. BUILD VITE FRONTEND
echo "🏗️ Building React Frontend..."
cd /home/ubuntu/vscode-web-ide/frontend
npm install
npm run build

# 4. PREPARE BACKEND & DOCKER IMAGE
echo "⚙️ Setting up Backend Server..."
cd /home/ubuntu/vscode-web-ide/backend
npm install

echo "🐳 Building lightweight Alpine Workspace Docker image..."
# Create the Dockerfile dynamically to ensure it's always there
cat << 'EOF' > Dockerfile.workspace
FROM alpine:3.19

# Install Node.js, Python, Git, and build tools
RUN apk add --no-cache \
    nodejs \
    npm \
    python3 \
    py3-pip \
    git \
    bash \
    curl \
    build-base

# Create a non-root developer user
RUN adduser -D -s /bin/bash developer

# Setup workspace directory
WORKDIR /home/developer/workspace
RUN chown -R developer:developer /home/developer/workspace

# Switch to the developer user
USER developer

# Expose standard app port
EXPOSE 3000

CMD ["tail", "-f", "/dev/null"]
EOF

sudo docker build -t vscode-workspace -f Dockerfile.workspace .

# 5. CONFIGURE NGINX
echo "🌐 Configuring Nginx Reverse Proxy with WebSocket & Dynamic Port Routing..."

cat << 'EOF' > /tmp/nginx.conf
server {
    listen 80;
    server_name _; # Default catch-all for IP address

    # Frontend Static Build
    root /home/ubuntu/vscode-web-ide/frontend/dist;
    index index.html;

    # Backend API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # WebSocket Terminal (Critical Fix)
    location /terminal {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Dynamic Live Preview Proxy Router
    # (The backend `http-proxy-middleware` handles the actual port resolution)
    location /preview/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # SPA routing fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

sudo mv /tmp/nginx.conf /etc/nginx/sites-available/vscode-ide
sudo ln -sf /etc/nginx/sites-available/vscode-ide /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl restart nginx

# 6. START PM2
echo "▶️ Launching Backend via PM2..."
cat << 'EOF' > ecosystem.config.js
module.exports = {
  apps: [{
    name: "vscode-web-ide-backend",
    script: "./server.js",
    cwd: "/home/ubuntu/vscode-web-ide/backend",
    instances: 1,
    exec_mode: "fork",
    env: {
      NODE_ENV: "production",
      PORT: 5000,
      ALLOWED_ORIGINS: "*", // Allow raw IP access
      WORKSPACE_DIR: "/home/ubuntu/vscode-web-ide/workspaces" // Root dir for Docker mounts
    }
  }]
}
EOF

pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -n 1 | sudo bash

echo "========================================================"
echo "✅ Deployment Scripts Built successfully!"
echo "Your IDE will be available at your EC2 Public IP address on port 80."
echo "========================================================"
