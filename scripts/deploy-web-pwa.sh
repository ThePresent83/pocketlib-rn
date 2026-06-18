#!/usr/bin/env bash
set -Eeuo pipefail

PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

DOMAIN=""
EMAIL=""
API_UPSTREAM="http://127.0.0.1:8080"
API_URL=""
WEB_ROOT="/var/www/pocketlib"
SITE_NAME="pocketlib"
SKIP_BUILD=0

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_ROOT"

step() {
  printf '\n==> %s\n' "$1"
}

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required but was not found in PATH"
}

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

usage() {
  cat <<'EOF'
Usage: bash scripts/deploy-web-pwa.sh --domain DOMAIN [options]

Required:
  --domain DOMAIN        Public DNS name, for example library.example.kz

Options:
  --email EMAIL          Obtain/renew a Let's Encrypt certificate automatically
  --api-upstream URL     Local backend URL. Default: http://127.0.0.1:8080
  --api-url URL          Public API URL compiled into PWA. Default: https://DOMAIN/api
  --web-root DIR         Nginx static root. Default: /var/www/pocketlib
  --site-name NAME       Nginx site filename. Default: pocketlib
  --skip-build           Deploy existing dist/web without rebuilding
  -h, --help             Show this help

Recommended first deployment:
  bash scripts/deploy-web-pwa.sh \
    --domain library.example.kz \
    --email admin@example.kz
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --domain)
      [ "$#" -ge 2 ] || fail "--domain requires a value"
      DOMAIN="$2"
      shift 2
      ;;
    --domain=*) DOMAIN="${1#*=}"; shift ;;
    --email)
      [ "$#" -ge 2 ] || fail "--email requires a value"
      EMAIL="$2"
      shift 2
      ;;
    --email=*) EMAIL="${1#*=}"; shift ;;
    --api-upstream)
      [ "$#" -ge 2 ] || fail "--api-upstream requires a value"
      API_UPSTREAM="$2"
      shift 2
      ;;
    --api-upstream=*) API_UPSTREAM="${1#*=}"; shift ;;
    --api-url)
      [ "$#" -ge 2 ] || fail "--api-url requires a value"
      API_URL="$2"
      shift 2
      ;;
    --api-url=*) API_URL="${1#*=}"; shift ;;
    --web-root)
      [ "$#" -ge 2 ] || fail "--web-root requires a value"
      WEB_ROOT="$2"
      shift 2
      ;;
    --web-root=*) WEB_ROOT="${1#*=}"; shift ;;
    --site-name)
      [ "$#" -ge 2 ] || fail "--site-name requires a value"
      SITE_NAME="$2"
      shift 2
      ;;
    --site-name=*) SITE_NAME="${1#*=}"; shift ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "unknown option: $1" ;;
  esac
done

[ -n "$DOMAIN" ] || fail "--domain is required"
printf '%s' "$DOMAIN" | grep -Eq '^[A-Za-z0-9.-]+$' || fail "--domain contains unsupported characters"
printf '%s' "$SITE_NAME" | grep -Eq '^[A-Za-z0-9._-]+$' || fail "--site-name contains unsupported characters"

API_UPSTREAM=$(printf '%s' "$API_UPSTREAM" | sed 's:/*$::')
if [ -z "$API_URL" ]; then
  API_URL="https://$DOMAIN/api"
fi
API_URL=$(printf '%s' "$API_URL" | sed 's:/*$::')

need_cmd node
need_cmd npm
need_cmd npx
need_cmd nginx
need_cmd rsync
need_cmd sed
if [ "$(id -u)" -ne 0 ]; then
  need_cmd sudo
fi

if [ "$SKIP_BUILD" -eq 0 ]; then
  step "Build PocketLib PWA"
  bash scripts/build-web-pwa.sh --api-url "$API_URL"
fi

test -f dist/web/index.html || fail "dist/web/index.html is missing; run the PWA build first"

step "Deploy static files"
as_root install -d -m 0755 "$WEB_ROOT"
as_root rsync -a --delete dist/web/ "$WEB_ROOT/"
as_root chown -R www-data:www-data "$WEB_ROOT"

render_nginx() {
  template="$1"
  target="$2"
  domain_escaped=$(printf '%s' "$DOMAIN" | sed 's/[&|]/\\&/g')
  root_escaped=$(printf '%s' "$WEB_ROOT" | sed 's/[&|]/\\&/g')
  upstream_escaped=$(printf '%s' "$API_UPSTREAM" | sed 's/[&|]/\\&/g')
  sed \
    -e "s|__DOMAIN__|$domain_escaped|g" \
    -e "s|__WEB_ROOT__|$root_escaped|g" \
    -e "s|__API_UPSTREAM__|$upstream_escaped|g" \
    "$template" > "$target"
}

TEMP_CONF=$(mktemp)
trap 'rm -f "$TEMP_CONF"' EXIT
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

if as_root test -f "$CERT_DIR/fullchain.pem" && as_root test -f "$CERT_DIR/privkey.pem"; then
  render_nginx deploy/nginx/pocketlib-https.conf.template "$TEMP_CONF"
else
  render_nginx deploy/nginx/pocketlib-http.conf.template "$TEMP_CONF"
fi

step "Configure Nginx"
as_root install -m 0644 "$TEMP_CONF" "/etc/nginx/sites-available/$SITE_NAME"
as_root ln -sfn "/etc/nginx/sites-available/$SITE_NAME" "/etc/nginx/sites-enabled/$SITE_NAME"
as_root nginx -t
as_root systemctl reload nginx

if ! as_root test -f "$CERT_DIR/fullchain.pem"; then
  if [ -n "$EMAIL" ]; then
    need_cmd certbot
    step "Obtain Let's Encrypt certificate"
    as_root certbot certonly \
      --webroot \
      --webroot-path "$WEB_ROOT" \
      --domain "$DOMAIN" \
      --email "$EMAIL" \
      --agree-tos \
      --deploy-hook "systemctl reload nginx" \
      --non-interactive

    render_nginx deploy/nginx/pocketlib-https.conf.template "$TEMP_CONF"
    as_root install -m 0644 "$TEMP_CONF" "/etc/nginx/sites-available/$SITE_NAME"
    as_root nginx -t
    as_root systemctl reload nginx
  else
    printf '\nHTTPS certificate is missing. Chrome will not show the PWA install icon yet.\n' >&2
    printf 'Run this deployment again with --email admin@example.kz after DNS points to this server.\n' >&2
  fi
fi

step "Deployment complete"
if as_root test -f "$CERT_DIR/fullchain.pem"; then
  PUBLIC_URL="https://$DOMAIN"
  printf 'PocketLib: https://%s\n' "$DOMAIN"
  printf 'API proxy: https://%s/api -> %s\n' "$DOMAIN" "$API_UPSTREAM"
  printf 'Chrome will show the install icon after the page is opened and the service worker activates.\n'
else
  PUBLIC_URL="http://$DOMAIN"
  printf 'PocketLib temporary HTTP URL: http://%s\n' "$DOMAIN"
  printf 'Run this deployment again with --email to enable HTTPS and the Chrome install icon.\n'
fi

if command -v curl >/dev/null 2>&1; then
  step "Verify published frontend and API"
  INDEX_HTML=$(curl -fsS --max-time 15 "$PUBLIC_URL/") || fail "published frontend is unavailable at $PUBLIC_URL"
  printf '%s' "$INDEX_HTML" | grep -q 'manifest.webmanifest' || fail "published root is not the production PWA; remove the proxy to Expo port 8081"
  printf '%s' "$INDEX_HTML" | grep -q "serviceWorker.register('/sw.js')" || fail "published root does not register the service worker"

  HEALTH_JSON=$(curl -fsS --max-time 15 "$PUBLIC_URL/api/health") || fail "API proxy is unavailable at $PUBLIC_URL/api/health"
  printf '%s' "$HEALTH_JSON" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' || fail "/api/health returned unexpected content; check the /api/ proxy"
  printf 'Frontend and API verification: OK\n'
fi
