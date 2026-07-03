#!/usr/bin/env bash
set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Helpers ──────────────────────────────────────────────────────────
info()  { echo -e "${CYAN}$1${NC}"; }
ok()    { echo -e "${GREEN}$1${NC}"; }
err()   { echo -e "${RED}$1${NC}" >&2; }
die()   { err "$1"; exit 1; }

# ─── Cleanup on exit ─────────────────────────────────────────────────
TEMP_DIR=""
cleanup() {
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    rm -rf "$TEMP_DIR"
  fi
}
trap cleanup EXIT

# ─── Argument parsing ────────────────────────────────────────────────
usage() {
  cat <<EOF
${BOLD}Agent Stuff — Remote Installer${NC}

Usage:
  curl -fsSL https://raw.githubusercontent.com/binhdv37/agent-stuff/main/install.sh | bash
  bash install.sh --help       Show this help

Clones the repo, runs the interactive installer, then cleans up.
EOF
  exit 0
}

for arg in "$@"; do
  case "$arg" in
    --help|-h) usage ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

# ─── Preflight checks ───────────────────────────────────────────────
command -v git >/dev/null || die "git is required but not found. Please install git first."
command -v bash >/dev/null || die "bash is required but not found."

# ─── Clone to temp dir ──────────────────────────────────────────────
REPO_URL="https://github.com/binhdv37/agent-stuff.git"
TEMP_DIR="$(mktemp -d "/tmp/agent-stuff-install-XXXX")"

info "Cloning agent-stuff..."
git clone --depth 1 "$REPO_URL" "$TEMP_DIR" 2>/dev/null || die "Failed to clone repository. Check your internet connection."

# ─── Run local installer ────────────────────────────────────────────
echo ""
info "Starting installer..."
echo ""
bash "$TEMP_DIR/local-install.sh"

ok "Done! Temp files cleaned up."
