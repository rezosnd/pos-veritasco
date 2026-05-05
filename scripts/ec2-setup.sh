#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# EC2 Ubuntu 22.04 LTS — Restaurant POS Backend Setup Script
# Run once after launching the EC2 instance
# ═══════════════════════════════════════════════════════════════
set -e

echo "🔧 Updating system..."
sudo apt-get update && sudo apt-get upgrade -y

echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "📦 Installing dependencies..."
sudo apt-get install -y git nginx certbot python3-certbot-nginx

echo "📦 Installing PM2..."
sudo npm install -g pm2

echo "📂 Creating app directory..."
mkdir -p /home/ubuntu/restaurant-pos
cd /home/ubuntu/restaurant-pos

echo "📥 Cloning repository..."
# git clone https://github.com/YOUR_USERNAME/restaurant-pos.git .
# OR copy files manually via scp:
# scp -r ./backend ubuntu@<EC2_IP>:/home/ubuntu/restaurant-pos/

echo "📦 Installing backend dependencies..."
cd backend
npm install --omit=dev

echo "📁 Creating required directories..."
mkdir -p uploads logs

echo "🔑 Setting up environment..."
# IMPORTANT: Copy your .env file:
# scp ./backend/.env ubuntu@<EC2_IP>:/home/ubuntu/restaurant-pos/backend/.env

echo "🌱 Seeding database..."
# node scripts/seed.js

echo "🚀 Starting with PM2..."
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup ubuntu

echo "✅ Backend setup complete!"
echo "   Backend running on port 5000"
echo "   Next: configure Nginx reverse proxy"
