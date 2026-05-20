# Cutthroat Corporation 🕵️‍♂️📈

A local-network social deduction game designed for adults, featuring an "IP-Lock" mechanic to ensure players are physically on the same network. 

## Ubuntu Server Deployment Guide (Docker)

This guide will walk you through deploying the game on a fresh Ubuntu Server. Since the app is completely dockerized, the setup is incredibly straightforward.

### Prerequisites
- A remote Ubuntu Server (20.04 LTS or 22.04 LTS recommended)
- SSH access to your server
- Git installed on your server

---

### Step 1: Install Docker on Ubuntu
Connect to your server via SSH and run the following commands to install Docker.

```bash
# Update package database
sudo apt update && sudo apt upgrade -y

# Install prerequisite packages
sudo apt install apt-transport-https ca-certificates curl software-properties-common -y

# Add Docker’s official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up the stable Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io -y

# (Optional) Allow running docker without sudo
sudo usermod -aG docker ${USER}
# Note: You may need to log out and log back in for this to take effect.
```

---

### Step 2: Clone the Repository
Pull the game code from your GitHub repository onto the server.

```bash
# Navigate to your preferred directory (e.g., /opt or your home folder)
cd ~

# Clone the repository
git clone https://github.com/TheMalikFaheem/cooperate-game.git

# Navigate into the project directory
cd cooperate-game
```

---

### Step 3: Build and Run the Docker Container
Build the docker image and spin it up. We will map port `3000` from the container to port `3000` on your Ubuntu server.

```bash
# Build the Docker image
sudo docker build -t cutthroat-corp .

# Run the container in detached mode (-d)
sudo docker run -d -p 3000:3000 --name cutthroat-corp --restart unless-stopped cutthroat-corp
```

Your game is now live! You can access it by going to `http://<YOUR_UBUNTU_SERVER_IP>:3000`. 
**Remember:** The first person who connects to it will lock the room to their specific Wi-Fi network's IP address.

---

### Step 4 (Recommended): Nginx Reverse Proxy Setup
If you are attaching a domain name (e.g., `game.yourdomain.com`) to this server, you will likely use Nginx. 

Because the game relies on **IP-Locking**, it is **CRITICAL** that Nginx forwards the real IP address to the Docker container, otherwise every player will look like they are connecting from `127.0.0.1` (the Nginx internal IP).

**1. Install Nginx:**
```bash
sudo apt install nginx -y
```

**2. Create a configuration file:**
```bash
sudo nano /etc/nginx/sites-available/cutthroat-corp
```

**3. Paste the following configuration (replace `game.yourdomain.com`):**
```nginx
server {
    listen 80;
    server_name game.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        
        # VERY IMPORTANT: These headers allow the Node.js IP-Lock to work
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (Required for Socket.io)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**4. Enable the site and restart Nginx:**
```bash
sudo ln -s /etc/nginx/sites-available/cutthroat-corp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Stopping or Updating the Game
If you make changes to the code and push to GitHub, run these commands on the server to update:
```bash
cd ~/cooperate-game
git pull origin main
sudo docker build -t cutthroat-corp .
sudo docker stop cutthroat-corp
sudo docker rm cutthroat-corp
sudo docker run -d -p 3000:3000 --name cutthroat-corp --restart unless-stopped cutthroat-corp
```
