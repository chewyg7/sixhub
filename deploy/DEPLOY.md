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
# The site listens on 127.0.0.1:3100 (see deploy/gtasixhub.service); check nothing else uses it:
#   ss -tlnp | grep ':3100\s'   (no output = free)
# Let the deploy script restart the site (and nothing else) without a password.
echo 'gtasixhub ALL=(root) NOPASSWD: /usr/bin/systemctl restart gtasixhub' > /etc/sudoers.d/gtasixhub
chmod 440 /etc/sudoers.d/gtasixhub
```

## 3. Get the code and configure it

```bash
sudo -u gtasixhub git clone --depth 1 https://github.com/chewyg7/sixhub.git /srv/gtasixhub
cp /srv/gtasixhub/deploy/gtasixhub.env.example /etc/gtasixhub.env
# Readable by root and the app user only (the deploy script runs as gtasixhub and loads it).
chown root:gtasixhub /etc/gtasixhub.env && chmod 640 /etc/gtasixhub.env
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
curl -sI http://127.0.0.1:3100 | head -1   # should print HTTP/1.1 200 OK
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

### 5b. If nginx already runs other sites on the server (use instead of Caddy)

Caddy and nginx can't both own ports 80/443. If `ss -tlnp | grep -E ':(80|443)\s'`
shows nginx, leave it in charge, remove Caddy and add the hub as another nginx site:

```bash
systemctl disable --now caddy; apt-get remove -y caddy
cp /srv/gtasixhub/deploy/nginx-gtasixhub.conf /etc/nginx/sites-available/gtasixhub
ln -s /etc/nginx/sites-available/gtasixhub /etc/nginx/sites-enabled/gtasixhub
nginx -t && systemctl reload nginx
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d gtasixhub.com -d www.gtasixhub.com --redirect
```

Run the Certbot line once the DNS records point at the server. It adds the
HTTPS certificate to that site only (other sites are untouched) and renews it
automatically.

## 5c. Cloudflare (DDoS protection, caching, hiding the server)

Do this before sharing the site widely. Cloudflare sits in front of the
server: it absorbs floods and bots, caches images and scripts around the
world, and visitors never talk to the server directly. The free plan is enough.

**1. Add the site.** In Cloudflare, *Add a site* → `gtasixhub.com` → Free.
If the domain's DNS isn't on Cloudflare yet, it imports the existing records
and asks you to switch the nameservers at your registrar. Check the imported
list against your current DNS first: the Zoho mail records (MX, SPF, DKIM)
must come across unchanged and stay **DNS only** (grey cloud).

**2. Proxy the website records.** In *DNS*, set `gtasixhub.com` and `www`
(A records to the server's IP) to **Proxied** (orange cloud). Leave every
other record as it is.

**3. HTTPS between Cloudflare and the server.**
- *SSL/TLS → Overview*: mode **Full (strict)**.
- *SSL/TLS → Origin Server → Create Certificate*: RSA, hostnames
  `gtasixhub.com` and `*.gtasixhub.com`, 15 years. Save both parts on the server:

```bash
mkdir -p /etc/ssl/cloudflare
nano /etc/ssl/cloudflare/gtasixhub.com.pem   # paste the Origin Certificate
nano /etc/ssl/cloudflare/gtasixhub.com.key   # paste the Private Key
chmod 600 /etc/ssl/cloudflare/gtasixhub.com.key
```

- *SSL/TLS → Edge Certificates*: **Always Use HTTPS** on.

**4. Install the nginx config** (after the deploy that brought this file):

```bash
sudo bash /srv/gtasixhub/deploy/cloudflare-setup.sh
```

It writes Cloudflare's address list for nginx (so rate limits and the admin
login throttle see visitors' real IPs), serves images and build files straight
from disk with long cache times, adds per-visitor rate limits, and makes nginx
refuse gtasixhub.com requests that didn't come through Cloudflare. It backs up
the old site file and puts it back if nginx rejects the new one. Check it:

```bash
curl -sI https://gtasixhub.com | grep -i -E 'server|cf-ray'   # should show "server: cloudflare" and a cf-ray
```

Re-run the script every few months; it refreshes Cloudflare's address list.

**5. Security settings in Cloudflare** (all free):
- *Security → Bots*: **Bot Fight Mode** on.
- *Security → Settings*: Security level **Medium**, **Browser Integrity Check** on.
- If the site is ever under attack: *Overview → Under Attack Mode* on (visitors
  see a short check first), off again once it's over.

**6. Optional: close the server to everything but Cloudflare.**
`sudo bash /srv/gtasixhub/deploy/cloudflare-setup.sh --firewall` limits ports
80/443 to Cloudflare in the firewall. This applies to **every site on the
server**, so only do it if they're all behind Cloudflare too. (Without it,
nginx already turns away direct visits to gtasixhub.com.)

**Uploads:** Cloudflare refuses requests over 100 MB, so the admin panel sends
big files in 48 MB pieces and the server joins them; nothing changes when
uploading.

**Undo:** set the records back to *DNS only*, and restore the backed-up site
file (`/etc/nginx/sites-available/gtasixhub.bak-…`), then `nginx -t && systemctl reload nginx`.

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

Everything worth keeping is in `/var/lib/gtasixhub`: the database and
`uploads/`. The code is on GitHub and in `/srv/gtasixhub`.

**Backups live on your PC, not the server.** On your Windows PC, this copies the
database (a temporary copy on the server, deleted once downloaded) and every uploaded file to `Documents\gtasixhub-backups` (after the
first run, only new or changed files):

```powershell
powershell -ExecutionPolicy Bypass -File "$HOME\Documents\gtasixhub\deploy\pull-backup.ps1" -Server root@89.117.59.155
```

Run it every week or so. To restore, stop the site, copy a `.db` file back to
`/var/lib/gtasixhub/gtasixhub.db` (owned by `gtasixhub`), copy `uploads/` back,
and start the site again.

## If something goes wrong

```bash
journalctl -u gtasixhub -n 100 --no-pager   # the site's logs
journalctl -u caddy -n 50 --no-pager        # HTTPS / certificate problems
systemctl restart gtasixhub
```
