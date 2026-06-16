#!/usr/bin/env sh
set -eu

API_URL="${EXPO_PUBLIC_API_URL:-}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8080}"
EXPO_HOST="${EXPO_HOST:-lan}"
EXPO_PORT="${EXPO_PORT:-8081}"
NO_DOCKER_BUILD=0
NO_EXPO_CLEAR=0

usage() {
  cat <<'EOF'
Usage:
  sh scripts/start-pocketlib.sh [options]

Options:
  --api-url URL          Public backend URL for the mobile app, for example http://192.168.1.10:8080
  --health-url URL       Local backend URL used only for health checks. Default: http://127.0.0.1:8080
  --expo-host VALUE      Expo host mode: lan, tunnel, or localhost. Default: lan
  --expo-port PORT       Expo dev server port. Default: 8081
  --no-docker-build      Run docker compose without --build
  --no-expo-clear        Run Expo without clearing cache
  -h, --help             Show this help

Notes:
  The backend is published by Docker on 0.0.0.0:8080 and Go listens on :8080.
  Do not use 0.0.0.0 as --api-url; clients need the real server IP or DNS name.
EOF
}

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

detect_host_ip() {
  if command -v ip >/dev/null 2>&1; then
    ip route get 1.1.1.1 2>/dev/null | awk '
      {
        for (i = 1; i <= NF; i++) {
          if ($i == "src") {
            print $(i + 1)
            exit
          }
        }
      }
    '
    return
  fi

  if command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{ print $1 }'
    return
  fi

  printf '127.0.0.1\n'
}

normalize_url() {
  printf '%s' "$1" | sed 's:/*$::'
}

host_from_url() {
  printf '%s' "$1" | sed -E 's#^[A-Za-z][A-Za-z0-9+.-]*://([^/:]+).*#\1#'
}

backend_is_ready() {
  url="$1/health"

  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 2 "$url" 2>/dev/null | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO- -T 2 "$url" 2>/dev/null | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'
    return
  fi

  fail "curl or wget is required for backend health checks"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --api-url)
      [ "$#" -ge 2 ] || fail "--api-url requires a value"
      API_URL="$2"
      shift 2
      ;;
    --api-url=*)
      API_URL="${1#*=}"
      shift
      ;;
    --health-url)
      [ "$#" -ge 2 ] || fail "--health-url requires a value"
      HEALTH_URL="$2"
      shift 2
      ;;
    --health-url=*)
      HEALTH_URL="${1#*=}"
      shift
      ;;
    --expo-host)
      [ "$#" -ge 2 ] || fail "--expo-host requires a value"
      EXPO_HOST="$2"
      shift 2
      ;;
    --expo-host=*)
      EXPO_HOST="${1#*=}"
      shift
      ;;
    --expo-port)
      [ "$#" -ge 2 ] || fail "--expo-port requires a value"
      EXPO_PORT="$2"
      shift 2
      ;;
    --expo-port=*)
      EXPO_PORT="${1#*=}"
      shift
      ;;
    --no-docker-build)
      NO_DOCKER_BUILD=1
      shift
      ;;
    --no-expo-clear)
      NO_EXPO_CLEAR=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

case "$EXPO_HOST" in
  lan|tunnel|localhost) ;;
  *) fail "--expo-host must be one of: lan, tunnel, localhost" ;;
esac

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_ROOT"

need_cmd docker
need_cmd npx
need_cmd sed
need_cmd grep
need_cmd awk
need_cmd tr

docker compose version >/dev/null 2>&1 || fail "docker compose is required"

if [ -z "$(printf '%s' "$API_URL" | tr -d '[:space:]')" ]; then
  HOST_IP=$(detect_host_ip)
  if [ -z "$HOST_IP" ]; then
    HOST_IP="127.0.0.1"
  fi
  API_URL="http://$HOST_IP:8080"
fi

case "$API_URL" in
  http://*|https://*) ;;
  *) API_URL="http://$API_URL" ;;
esac

API_URL=$(normalize_url "$API_URL")
HEALTH_URL=$(normalize_url "$HEALTH_URL")
PACKAGER_HOST=$(host_from_url "$API_URL")

case "$PACKAGER_HOST" in
  0.0.0.0)
    fail "0.0.0.0 is a bind address, not a client URL. Use the real server IP or DNS in --api-url"
    ;;
esac

export EXPO_PUBLIC_API_URL="$API_URL"
export REACT_NATIVE_PACKAGER_HOSTNAME="${REACT_NATIVE_PACKAGER_HOSTNAME:-$PACKAGER_HOST}"

step "Start backend"
if [ "$NO_DOCKER_BUILD" -eq 1 ]; then
  docker compose -f Backend/services-up/docker-compose.yml up -d
else
  docker compose -f Backend/services-up/docker-compose.yml up -d --build
fi

step "Wait for backend $HEALTH_URL"
i=1
while [ "$i" -le 30 ]; do
  if backend_is_ready "$HEALTH_URL"; then
    printf 'Backend ready: %s\n' "$API_URL"
    break
  fi

  if [ "$i" -eq 30 ]; then
    printf 'Warning: backend is not responding yet. Check logs: docker compose -f Backend/services-up/docker-compose.yml logs api\n' >&2
    break
  fi

  i=$((i + 1))
  sleep 2
done

step "Start Expo"
printf 'EXPO_PUBLIC_API_URL=%s\n' "$EXPO_PUBLIC_API_URL"
printf 'REACT_NATIVE_PACKAGER_HOSTNAME=%s\n' "$REACT_NATIVE_PACKAGER_HOSTNAME"

set -- expo start --host "$EXPO_HOST" --port "$EXPO_PORT"
if [ "$NO_EXPO_CLEAR" -eq 0 ]; then
  set -- "$@" -c
fi

exec npx "$@"
