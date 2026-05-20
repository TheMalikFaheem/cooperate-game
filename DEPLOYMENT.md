# 🚀 Deployment Guide — GuessME on `zerocost.academy`

This guide covers deploying GuessME on an Ubuntu server using **Docker Compose** + **Nginx** + **Let's Encrypt SSL**.

> **Prerequisites:**
> - Ubuntu 20.04 / 22.04 server
> - Domain `zerocost.academy` DNS A record already pointed to your server's IP
> - SSH access to the server

---

## Step 1 — Install Required Software

SSH into your server and run:

```bash
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install -y docker.io docker-compose-plugin

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# Install Git
sudo apt install -y git
```

---

## Step 2 — Clone the Repository

```bash
cd ~
git clone https://github.com/TheMalikFaheem/cooperate-game.git guessme
cd guessme
```

---

## Step 3 — Start the App with Docker Compose

```bash
sudo docker compose up -d --build
```

Verify it's running:

```bash
sudo docker compose ps
```

You should see the container with status `Up`. The app is now running on port **4000** internally.

---

## Step 4 — Configure Nginx (HTTP first, then HTTPS)

Create the Nginx config file:

```bash
sudo nano /etc/nginx/sites-available/guessme
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name zerocost.academy www.zerocost.academy;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;

        # Required for Socket.io WebSockets
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

Enable the site and test:

```bash
sudo ln -s /etc/nginx/sites-available/guessme /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 5 — Get SSL Certificate (HTTPS)

```bash
sudo certbot --nginx -d zerocost.academy -d www.zerocost.academy
```

Follow the prompts:
- Enter your email address
- Agree to the terms of service (press `Y`)
- Choose option **2** to redirect HTTP to HTTPS automatically

Certbot will automatically update your Nginx config with SSL settings.

Verify auto-renewal works:

```bash
sudo certbot renew --dry-run
```

---

## Step 6 — Verify Everything

Open your browser and go to:

```
https://zerocost.academy
```

You should see the GuessME login page with a valid SSL certificate (padlock icon).

---

## Updating the App

Whenever there's a new version, run:

```bash
cd ~/guessme
git pull origin main
sudo docker compose up -d --build
```

---

## Useful Management Commands

```bash
# View live app logs
sudo docker compose logs -f

# Stop the app
sudo docker compose down

# Restart the app
sudo docker compose restart

# Check Nginx status
sudo systemctl status nginx

# Check SSL certificate expiry
sudo certbot certificates
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Port 4000 not responding | Run `sudo docker compose ps` to check container status |
| Nginx shows 502 Bad Gateway | The Docker container may have crashed — run `sudo docker compose up -d` |
| SSL certificate not working | Make sure DNS is fully propagated before running Certbot |
| WebSockets not connecting | Ensure the `Upgrade` and `Connection` headers are in the Nginx config |
| App shows old version after update | Run `sudo docker compose down && sudo docker compose up -d --build` |

---

## Data & Backups

The SQLite database is stored in the `./data/` folder and mounted as a Docker volume. To back it up:

```bash
cp ~/guessme/data/guessme.db ~/guessme_backup_$(date +%Y%m%d).db
```
