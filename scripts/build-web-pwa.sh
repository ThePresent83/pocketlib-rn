#!/usr/bin/env bash
set -Eeuo pipefail

API_URL="${EXPO_PUBLIC_API_URL:-}"
OUTPUT_DIR="dist/web"
SKIP_TYPECHECK=0
SKIP_BACKEND_CHECK=0
STRICT_BACKEND=0

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

usage() {
  cat <<'EOF'
Usage: bash scripts/build-web-pwa.sh [options]

Options:
  --api-url URL          Public backend URL compiled into the web app
  --output-dir DIR       Output directory inside the project. Default: dist/web
  --skip-typecheck       Skip TypeScript validation
  --skip-backend-check   Skip GET /health
  --strict-backend       Fail if the backend health check fails
  -h, --help             Show this help

Example:
  bash scripts/build-web-pwa.sh --api-url https://library.example.kz/api
EOF
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
    --output-dir)
      [ "$#" -ge 2 ] || fail "--output-dir requires a value"
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --output-dir=*)
      OUTPUT_DIR="${1#*=}"
      shift
      ;;
    --skip-typecheck)
      SKIP_TYPECHECK=1
      shift
      ;;
    --skip-backend-check)
      SKIP_BACKEND_CHECK=1
      shift
      ;;
    --strict-backend)
      STRICT_BACKEND=1
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

need_cmd node
need_cmd npm
need_cmd npx

if [ -z "$(printf '%s' "$API_URL" | tr -d '[:space:]')" ]; then
  API_URL="http://127.0.0.1:8080"
fi

case "$API_URL" in
  http://*|https://*) ;;
  *) fail "--api-url must start with http:// or https://" ;;
esac

case "$OUTPUT_DIR" in
  dist|dist/*) ;;
  *) fail "--output-dir must be dist or a directory under dist/" ;;
esac

API_URL=$(printf '%s' "$API_URL" | sed 's:/*$::')
export EXPO_PUBLIC_API_URL="$API_URL"

step "PocketLib PWA build"
printf 'Project: %s\n' "$PROJECT_ROOT"
printf 'API URL: %s\n' "$API_URL"
printf 'Output: %s/%s\n' "$PROJECT_ROOT" "$OUTPUT_DIR"

case "$API_URL" in
  http://localhost*|http://127.0.0.1*) ;;
  http://*)
    printf 'Warning: Chrome requires HTTPS for an installable PWA, and an HTTPS site cannot call this HTTP API.\n' >&2
    ;;
esac

if [ ! -d node_modules ]; then
  step "Install Node dependencies"
  npm ci
fi

if [ "$SKIP_TYPECHECK" -eq 0 ]; then
  step "TypeScript check"
  npx tsc --noEmit
fi

if [ "$SKIP_BACKEND_CHECK" -eq 0 ]; then
  step "Backend health check"
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS --max-time 8 "$API_URL/health" >/dev/null; then
      printf 'Backend: OK\n'
    elif [ "$STRICT_BACKEND" -eq 1 ]; then
      fail "backend is not responding at $API_URL/health"
    else
      printf 'Warning: backend is not responding at %s/health\n' "$API_URL" >&2
    fi
  elif command -v wget >/dev/null 2>&1; then
    if wget -q -T 8 -O /dev/null "$API_URL/health"; then
      printf 'Backend: OK\n'
    elif [ "$STRICT_BACKEND" -eq 1 ]; then
      fail "backend is not responding at $API_URL/health"
    else
      printf 'Warning: backend is not responding at %s/health\n' "$API_URL" >&2
    fi
  elif [ "$STRICT_BACKEND" -eq 1 ]; then
    fail "curl or wget is required for a strict backend check"
  else
    printf 'Warning: curl and wget are missing; backend check skipped.\n' >&2
  fi
fi

step "Expo web export"
rm -rf -- "$OUTPUT_DIR"
npx expo export --platform web --clear --output-dir "$OUTPUT_DIR"

step "PWA assets"
cp -a public/. "$OUTPUT_DIR/"
node scripts/inject-pwa-html.mjs "$OUTPUT_DIR/index.html"

test -f "$OUTPUT_DIR/manifest.webmanifest" || fail "manifest.webmanifest is missing"
test -f "$OUTPUT_DIR/sw.js" || fail "sw.js is missing"
test -f "$OUTPUT_DIR/pwa/icon-192.png" || fail "192px icon is missing"
test -f "$OUTPUT_DIR/pwa/icon-512.png" || fail "512px icon is missing"
grep -q 'manifest.webmanifest' "$OUTPUT_DIR/index.html" || fail "manifest link is missing from index.html"
grep -q "serviceWorker.register('/sw.js')" "$OUTPUT_DIR/index.html" || fail "service worker registration is missing"

printf '\nDone: %s/%s\n' "$PROJECT_ROOT" "$OUTPUT_DIR"
