# PocketLib PWA on Debian

Chrome shows the install icon in the address bar automatically when all of these conditions are met:

- the site is opened over HTTPS;
- `manifest.webmanifest` is valid and contains 192px and 512px icons;
- `/sw.js` is registered and controls the page;
- the site is not already installed;
- the public API is also available over HTTPS.

PocketLib serves the frontend and backend through one domain:

```text
https://library.example.kz       -> PWA frontend
https://library.example.kz/api   -> backend on 127.0.0.1:8080
```

## 1. Prepare DNS

Create an `A` record for the selected domain and point it to the Debian server public IP.

## 2. Install server packages

Node.js 20 or newer and npm must already be installed. Install the deployment packages:

```bash
sudo apt-get update
sudo apt-get install -y nginx rsync certbot curl
```

## 3. Start the backend

From the PocketLib project directory:

```bash
docker compose -f Backend/services-up/docker-compose.yml up -d --build
curl -fsS http://127.0.0.1:8080/health
```

## 4. Deploy the PWA

Replace the domain and email with real values:

```bash
npm ci
npm run deploy:web:pwa -- \
  --domain library.example.kz \
  --email admin@example.kz
```

The command performs the full deployment:

- builds Expo web with `https://DOMAIN/api` as the API URL;
- copies the result to `/var/www/pocketlib`;
- configures Nginx and the `/api` proxy;
- obtains a Let's Encrypt certificate;
- reloads Nginx.

If the backend is running on another local address, pass it explicitly:

```bash
npm run deploy:web:pwa -- \
  --domain library.example.kz \
  --email admin@example.kz \
  --api-upstream http://127.0.0.1:8080
```

## 5. Verify installability

```bash
curl -I https://library.example.kz/manifest.webmanifest
curl -I https://library.example.kz/sw.js
curl -fsS https://library.example.kz/api/health
```

Open `https://library.example.kz` in Chrome. After the first page load and service worker activation, Chrome displays the install icon in the address bar. It is also available through the Chrome menu as `Install PocketLib`.

For an update, run the same deployment command again. PWA cache versions are managed by `public/sw.js`.

## Existing OpenResty domain

Do not proxy the domain root to `expo start --web` or port `8081`. That is the Expo development server and it is not an installable production PWA.

Find the active domain configuration:

```bash
sudo nginx -T 2>&1 | grep -n -B 10 -A 80 "server_name poketlib.aspc.kz"
```

Keep the existing SSL certificate directives, remove the root proxy to port `8081`, and use these locations inside the HTTPS `server` block:

```nginx
root /var/www/pocketlib;
index index.html;

location ^~ /api/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 128m;
    proxy_read_timeout 120s;
}

location = /sw.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Service-Worker-Allowed "/" always;
    try_files $uri =404;
}

location = /manifest.webmanifest {
    default_type application/manifest+json;
    add_header Cache-Control "no-cache" always;
    try_files $uri =404;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

Validate and reload the active server:

```bash
sudo nginx -t
sudo systemctl reload openresty || sudo systemctl reload nginx
```

The following command must return JSON, not `index.html`:

```bash
curl -fsS https://poketlib.aspc.kz/api/health
# {"status":"ok"}
```
