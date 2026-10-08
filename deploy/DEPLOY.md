# Deploying GTA 6 Hub to a VPS (Ubuntu 22.04 / 24.04)

The site runs as one Node.js process behind Caddy, which handles HTTPS. The
database (SQLite) and everything uploaded in the admin panel live in
`/var/lib/gtasixhub`, outside the code, so deploys never touch them.

Run every command below over SSH (`ssh root@YOUR_SERVER_IP`).

## Before you start

- **Server:** 2 CPU cores and 4 GB RAM or more is comfortable (any Contabo
  Cloud VPS is fine). The build is the heaviest part; with less than 4 GB,
  add swap first (step 1b).
- **Domain:** you'll point `gtasixhub.com` and `www.gtasixhub.com` at the
  server in step 5. If the domain is connected to Netlify, remove it there
  (Netlify → Domain management) so the two don't fight over it.
- **Code:** the server pulls from GitHub, so push your latest changes first.

## 1. Install Node.js 22, Caddy and git

```bash
apt-get update && apt-get upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git build-essential debian-keyring debian-archive-keyring apt-transport-https curl sqlite3 ufw
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy
node -v   # should print v22.x
```

### 1b. (Only if the server has less than 4 GB RAM) add 4 GB of swap

```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 2. Create the app user and folders

```bash
useradd --system --create-home --shell /bin/bash gtasixhub
mkdir -p /srv/gtasixhub /var/lib/gtasixhub
chown gtasixhub:gtasixhub /srv/gtasixhub /var/lib/gtasixhub
chmod 700 /var/lib/gtasixhub
# Let the deploy script restart the site (and nothing else) without a password.
echo 'gtasixhub ALL=(root) NOPASSWD: /usr/bin/systemctl restart gtasixhub' > /etc/sudoers.d/gtasixhub
chmod 440 /etc/sudoers.d/gtasixhub
```

## 3. Get the code and configure it

```bash
sudo -u gtasixhub git clone https://github.com/chewyg7/sixhub.git /srv/gtasixhub
cp /srv/gtasixhub/deploy/gtasixhub.env.example /etc/gtasixhub.env
chmod 600 /etc/gtasixhub.env
# Generate the two secrets and put them in the file:
sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -base64 32)|" /etc/gtasixhub.env
sed -i "s|^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=.*|NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$(openssl rand -base64 32)|" /etc/gtasixhub.env
cat /etc/gtasixhub.env   # check both lines now have a value
```

Keep `/etc/gtasixhub.env` safe: if `AUTH_SECRET` is lost, everyone's
two-factor setup has to be redone.

If the repository is private, `git clone` asks for a GitHub username and a
**personal access token** (GitHub → Settings → Developer settings → Fine-grained
tokens, read-only access to this repo) instead of your password.

## 4. Build and start

```bash
chmod +x /srv/gtasixhub/deploy/deploy.sh
cp /srv/gtasixhub/deploy/gtasixhub.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable gtasixhub
sudo -u gtasixhub /srv/gtasixhub/deploy/deploy.sh
systemctl status gtasixhub --no-pager   # should say "active (running)"
curl -sI http://127.0.0.1:3000 | head -1   # should print HTTP/1.1 200 OK
```

The first build creates the database and fills it with the archive. It takes a
few minutes.

## 5. Domain and HTTPS

At your domain registrar (or Cloudflare), set these DNS records to the server's IP:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `YOUR_SERVER_IP` |
| A | `www` | `YOUR_SERVER_IP` |

If you use Cloudflare, set both to **DNS only** (grey cloud) at first, so
Caddy can get its certificate. Then:

```bash
cp /srv/gtasixhub/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
ufw allow OpenSSH && ufw allow 80,443/tcp && ufw --force enable
```

Once DNS has updated (minutes to a few hours), `https://gtasixhub.com` serves
the site with a certificate Caddy renews by itself.

## 6. Create the owner accounts

Passwords are typed at a hidden prompt; they never go into a file or your shell
history. Use new passwords (not ones that were ever pasted in a chat).

```bash
cd /srv/gtasixhub
sudo -u gtasixhub env DATA_DIR=/var/lib/gtasixhub npm run admin -- create Exid
sudo -u gtasixhub env DATA_DIR=/var/lib/gtasixhub npm run admin -- create Dyllie
```

Then sign in at `https://gtasixhub.com/chewy` and turn on two-factor
authentication under **Your profile**.

Other account commands (same prefix): `reset-password <name>`,
`disable-2fa <name>`, `unlock <name>`, `unblock-ips`, `list`.

## Updating the site

Push to GitHub, then on the server:

```bash
sudo -u gtasixhub /srv/gtasixhub/deploy/deploy.sh
```

Content edits made in the admin panel are live immediately and need no deploy.

## Backups

Everything worth keeping is in `/var/lib/gtasixhub`. The admin panel's
**System & backups** page makes database snapshots, but they sit on the same
server; also copy them somewhere else. A nightly copy:

```bash
crontab -e
# 30 3 * * * sqlite3 /var/lib/gtasixhub/gtasixhub.db ".backup /root/backup-$(date +\%a).db" && tar czf /root/uploads-$(date +\%a).tgz -C /var/lib/gtasixhub uploads
```

## If something goes wrong

```bash
journalctl -u gtasixhub -n 100 --no-pager   # the site's logs
journalctl -u caddy -n 50 --no-pager        # HTTPS / certificate problems
systemctl restart gtasixhub
```
