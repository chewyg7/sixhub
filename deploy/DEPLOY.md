# Deploying GTA 6 Hub to a VPS (Ubuntu 22.04/24.04)

The site runs as one Node.js process behind Caddy, which handles HTTPS. The
database (SQLite) and uploaded files live in `/var/lib/gtasixhub`, outside the
code, so deploys never touch them. Run every command below over SSH.

## 1. Install Node.js 22, Caddy and git

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git build-essential debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

## 2. Create the app user and folders

```bash
sudo useradd --system --create-home --shell /bin/bash gtasixhub
sudo mkdir -p /srv/gtasixhub /var/lib/gtasixhub
sudo chown gtasixhub:gtasixhub /srv/gtasixhub /var/lib/gtasixhub
sudo chmod 700 /var/lib/gtasixhub
# Let the deploy script restart the service (and nothing else) without a password.
echo 'gtasixhub ALL=(root) NOPASSWD: /usr/bin/systemctl restart gtasixhub' | sudo tee /etc/sudoers.d/gtasixhub
```

## 3. Get the code and configure it

```bash
sudo -u gtasixhub git clone https://github.com/chewyg7/sixhub.git /srv/gtasixhub
sudo cp /srv/gtasixhub/deploy/gtasixhub.env.example /etc/gtasixhub.env
sudo chmod 600 /etc/gtasixhub.env
sudo nano /etc/gtasixhub.env   # fill AUTH_SECRET and NEXT_SERVER_ACTIONS_ENCRYPTION_KEY (openssl rand -base64 32 for each)
```

## 4. Build and start

```bash
sudo chmod +x /srv/gtasixhub/deploy/deploy.sh
sudo cp /srv/gtasixhub/deploy/gtasixhub.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable gtasixhub
sudo -u gtasixhub bash -c 'cd /srv/gtasixhub && git pull' # (already cloned)
sudo -u gtasixhub /srv/gtasixhub/deploy/deploy.sh
```

The first build creates the database and fills it with the archive.

## 5. HTTPS

Point the domain's DNS `A` record (and `www`) at the server's IP, then:

```bash
sudo cp /srv/gtasixhub/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
```

## 6. Create the owner accounts

Passwords are typed at a hidden prompt; they never go into a file or your shell history.

```bash
cd /srv/gtasixhub
sudo -u gtasixhub --preserve-env=DATA_DIR env DATA_DIR=/var/lib/gtasixhub npm run admin -- create Exid
sudo -u gtasixhub env DATA_DIR=/var/lib/gtasixhub npm run admin -- create Dyllie
```

Then sign in at `https://gtasixhub.com/chewy` and turn on two-factor authentication under **Your profile**.

Other account commands (same prefix): `reset-password <name>`, `disable-2fa <name>`, `unlock <name>`, `list`.

## Updating the site

Push to GitHub, then on the server:

```bash
sudo -u gtasixhub /srv/gtasixhub/deploy/deploy.sh
```

Content edits made in the admin panel are live immediately and need no deploy.

## Backups

Everything worth keeping is in `/var/lib/gtasixhub`. A nightly copy:

```bash
sudo crontab -e
# 30 3 * * * sqlite3 /var/lib/gtasixhub/gtasixhub.db ".backup /root/backup-$(date +\%a).db" && tar czf /root/uploads-$(date +\%a).tgz -C /var/lib/gtasixhub uploads
```
