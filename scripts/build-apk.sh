#!/bin/sh
set -eu

PROFILE="apk"
API_URL="${EXPO_PUBLIC_API_URL:-}"
OUTPUT_DIR="dist/apk"
LOCAL=0
NO_DOWNLOAD=0
DRY_RUN=0
SKIP_TYPECHECK=0
SKIP_BACKEND_CHECK=0
STRICT_BACKEND=0

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_ROOT"

step() {
  printf "\n==> %s\n" "$1"
}

usage() {
  cat <<'EOF'
Usage: sh scripts/build-apk.sh [options]

Options:
  --profile apk|preview|production
  --api-url URL
  --output-dir DIR
  --local
  --no-download
  --dry-run
  --skip-typecheck
  --skip-backend-check
  --strict-backend
  -h, --help
EOF
}

die() {
  printf "Error: %s\n" "$1" >&2
  exit 1
}

eas() {
  if command -v eas >/dev/null 2>&1; then
    command eas "$@"
  else
    npx --yes eas-cli@latest "$@"
  fi
}

get_arg_value() {
  [ "$#" -ge 2 ] || die "Missing value for $1"
  printf "%s" "$2"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --profile)
      PROFILE=$(get_arg_value "$@")
      shift 2
      ;;
    --profile=*)
      PROFILE=${1#*=}
      shift
      ;;
    --api-url)
      API_URL=$(get_arg_value "$@")
      shift 2
      ;;
    --api-url=*)
      API_URL=${1#*=}
      shift
      ;;
    --output-dir)
      OUTPUT_DIR=$(get_arg_value "$@")
      shift 2
      ;;
    --output-dir=*)
      OUTPUT_DIR=${1#*=}
      shift
      ;;
    --local)
      LOCAL=1
      shift
      ;;
    --no-download)
      NO_DOWNLOAD=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
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
      die "Unknown option: $1"
      ;;
  esac
done

case "$PROFILE" in
  apk|preview|production) ;;
  *) die "--profile must be one of: apk, preview, production" ;;
esac

get_lan_api_url() {
  ip=""

  if command -v ip >/dev/null 2>&1; then
    ip=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i == "src") {print $(i+1); exit}}')
  fi

  if [ -z "$ip" ] && command -v hostname >/dev/null 2>&1; then
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  fi

  if [ -z "$ip" ]; then
    ip="127.0.0.1"
  fi

  printf "http://%s:8080" "$ip"
}

if [ -z "$(printf "%s" "$API_URL" | tr -d '[:space:]')" ]; then
  API_URL=$(get_lan_api_url)
fi

API_URL=$(printf "%s" "$API_URL" | sed 's:/*$::')
export EXPO_PUBLIC_API_URL="$API_URL"

step "PocketLib APK build"
printf "Project: %s\n" "$PROJECT_ROOT"
printf "Profile: %s\n" "$PROFILE"
printf "API URL: %s\n" "$API_URL"

case "$API_URL" in
  *localhost*|*127.0.0.1*|*10.0.2.2*)
    printf "Phone-safe API URL: False\n"
    printf "Warning: This API URL will not work on a real phone. Use your PC LAN IP or a public server URL.\n" >&2
    ;;
  *)
    printf "Phone-safe API URL: True\n"
    ;;
esac

if [ "$SKIP_TYPECHECK" -eq 0 ]; then
  step "TypeScript check"
  npx tsc --noEmit
fi

if [ "$SKIP_BACKEND_CHECK" -eq 0 ]; then
  step "Backend health check"
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS --max-time 5 "$API_URL/health" >/dev/null; then
      printf "Backend: OK\n"
    elif [ "$STRICT_BACKEND" -eq 1 ]; then
      die "Backend is not responding at $API_URL/health"
    else
      printf "Warning: Backend is not responding at %s/health. The APK can be built, but the app will not see this server URL.\n" "$API_URL" >&2
    fi
  elif command -v wget >/dev/null 2>&1; then
    if wget -q -T 5 -O /dev/null "$API_URL/health"; then
      printf "Backend: OK\n"
    elif [ "$STRICT_BACKEND" -eq 1 ]; then
      die "Backend is not responding at $API_URL/health"
    else
      printf "Warning: Backend is not responding at %s/health. The APK can be built, but the app will not see this server URL.\n" "$API_URL" >&2
    fi
  else
    printf "Warning: curl or wget was not found; skipping backend health check.\n" >&2
  fi
fi

get_eas_project_id() {
  node -e '
const fs = require("fs");
try {
  const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
  process.stdout.write(app?.expo?.extra?.eas?.projectId || "");
} catch {
  process.stdout.write("");
}
'
}

set_eas_profile_api_url() {
  node - "$PROFILE" "$API_URL" <<'NODE'
const fs = require("fs");
const profile = process.argv[2];
const apiUrl = process.argv[3];
const path = "eas.json";

if (!fs.existsSync(path)) {
  console.error("eas.json was not found");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(path, "utf8"));
config.build ??= {};
config.build[profile] ??= {};
config.build[profile].env ??= {};
config.build[profile].env.EXPO_PUBLIC_API_URL = apiUrl;

fs.writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
NODE
}

step "EAS Android build"
if [ -z "${EXPO_TOKEN:-}" ]; then
  EXPO_USER=$(eas whoami 2>/dev/null || true)
  if [ -z "$EXPO_USER" ]; then
    cat <<'EOF'

EAS cloud build requires an Expo account.
Run: npx --yes eas-cli@latest login

No Expo account? Build locally instead:
npm run build:apk:easy
EOF
    exit 1
  fi
  printf "Expo account: %s\n" "$EXPO_USER"
else
  printf "Expo account: EXPO_TOKEN is set\n"
fi

EAS_PROJECT_ID=$(get_eas_project_id)
if [ -z "$EAS_PROJECT_ID" ]; then
  cat <<'EOF'

EAS project is not configured yet.
Run once in this project:
npx eas-cli@latest init

Then run the build again:
npm run build:apk:eas:debian

No Expo cloud needed? Use local APK build instead:
npm run build:apk:easy
EOF
  exit 1
fi
printf "EAS project ID: %s\n" "$EAS_PROJECT_ID"

if [ "$DRY_RUN" -eq 1 ]; then
  printf "Would write EXPO_PUBLIC_API_URL=%s to eas.json profile '%s'\n" "$API_URL" "$PROFILE"
  printf "Dry run command: npx --yes eas-cli@latest build --platform android --profile %s --non-interactive --wait" "$PROFILE"
  if [ "$LOCAL" -eq 1 ]; then
    printf " --local"
  fi
  printf "\n"
  exit 0
fi

set_eas_profile_api_url
printf "EAS env EXPO_PUBLIC_API_URL: %s\n" "$API_URL"

if [ "$LOCAL" -eq 1 ]; then
  eas build --platform android --profile "$PROFILE" --non-interactive --wait --local
else
  eas build --platform android --profile "$PROFILE" --non-interactive --wait
fi

if [ "$NO_DOWNLOAD" -eq 1 ] || [ "$LOCAL" -eq 1 ]; then
  printf "\nBuild finished. For local builds, EAS CLI prints the artifact path.\n"
  exit 0
fi

step "Download latest Android artifact"
mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +"%Y%m%d-%H%M")
if [ "$PROFILE" = "production" ]; then
  EXTENSION="aab"
else
  EXTENSION="apk"
fi
ARTIFACT_PATH="$OUTPUT_DIR/pocketlib-$PROFILE-$TIMESTAMP.$EXTENSION"

eas build:download --platform android --latest --path "$ARTIFACT_PATH" --non-interactive
printf "\nDone: %s\n" "$ARTIFACT_PATH"
