#!/usr/bin/env bash
set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Resolve script location ─────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_SRC="$SCRIPT_DIR/skills"
AGENTS_SRC="$SCRIPT_DIR/opencode/agents"

# ─── Helpers ──────────────────────────────────────────────────────────
info()  { echo -e "${CYAN}$1${NC}"; }
ok()    { echo -e "${GREEN}$1${NC}"; }
warn()  { echo -e "${YELLOW}$1${NC}"; }
err()   { echo -e "${RED}$1${NC}" >&2; }
die()   { err "$1"; exit 1; }

usage() {
  cat <<EOF
${BOLD}BDV Agent Skills Installer${NC}

Usage:
  bash install.sh              Interactive mode (prompts for choices)
  bash install.sh --help       Show this help

Installs bdv-prefixed agent skills and OpenCode custom agents
to the appropriate directories for your AI agent setup.
EOF
  exit 0
}

# ─── Argument parsing ────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --help|-h) usage ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

# ─── Preflight checks ───────────────────────────────────────────────
command -v cp  >/dev/null || die "cp not found"
command -v mkdir >/dev/null || die "mkdir not found"

[[ -d "$SKILLS_SRC" ]] || die "Skills directory not found: $SKILLS_SRC"
[[ -d "$AGENTS_SRC" ]] || die "Agents directory not found: $AGENTS_SRC"

# ─── Step 1: Choose AI agent ─────────────────────────────────────────
echo ""
echo -e "${BOLD}Step 1: Which AI agent are you using?${NC}"
echo ""
echo "  1) OpenCode"
echo "  2) Codex"
echo "  3) Claude Code"
echo ""

while true; do
  read -rp "Enter choice [1-3]: " agent_choice
  case "$agent_choice" in
    1) AGENT="opencode";   break ;;
    2) AGENT="codex";      break ;;
    3) AGENT="claudecode"; break ;;
    *) echo "  Invalid choice. Please enter 1, 2, or 3." ;;
  esac
done

echo -e "  → Agent: ${GREEN}${AGENT}${NC}"

# ─── Step 2: Choose scope ────────────────────────────────────────────
echo ""
echo -e "${BOLD}Step 2: Install globally (all projects) or locally (this project only)?${NC}"
echo ""
echo "  1) Globally  — install to user config (~/.config, ~/.claude, etc.)"
echo "  2) Locally   — install to current project directory (.opencode, .claude, etc.)"
echo ""

while true; do
  read -rp "Enter choice [1-2]: " scope_choice
  case "$scope_choice" in
    1) SCOPE="global";  break ;;
    2) SCOPE="local";   break ;;
    *) echo "  Invalid choice. Please enter 1 or 2." ;;
  esac
done

echo -e "  → Scope: ${GREEN}${SCOPE}${NC}"

# ─── Determine target paths ──────────────────────────────────────────
case "${AGENT}-${SCOPE}" in
  opencode-global)
    SKILLS_DIR="$HOME/.config/opencode/skills"
    AGENTS_DIR="$HOME/.config/opencode/agents"
    ;;
  opencode-local)
    SKILLS_DIR=".opencode/skills"
    AGENTS_DIR=".opencode/agents"
    ;;
  codex-global)
    SKILLS_DIR="$HOME/.codex/skills"
    AGENTS_DIR=""  # Codex: no custom agents in this repo
    ;;
  codex-local)
    SKILLS_DIR=".agents/skills"
    AGENTS_DIR=""
    ;;
  claudecode-global)
    SKILLS_DIR="$HOME/.claude/skills"
    AGENTS_DIR=""  # Claude Code: no custom agents in this repo
    ;;
  claudecode-local)
    SKILLS_DIR=".claude/skills"
    AGENTS_DIR=""
    ;;
esac

# ─── Install skills ──────────────────────────────────────────────────
echo ""
info "Installing skills to: $SKILLS_DIR"
mkdir -p "$SKILLS_DIR"

SKILLS_INSTALLED=0
for skill_dir in "$SKILLS_SRC"/*/; do
  skill_name="$(basename "$skill_dir")"
  skill_file="$skill_dir/SKILL.md"

  if [[ ! -f "$skill_file" ]]; then
    warn "  Skipping $skill_name — no SKILL.md found"
    continue
  fi

  cp -R "$skill_dir" "$SKILLS_DIR/$skill_name"
  ok "  ✓ $skill_name"
  ((SKILLS_INSTALLED++))
done

echo -e "  → ${GREEN}${SKILLS_INSTALLED} skills installed${NC}"

# ─── Install agent-specific (OpenCode only) ──────────────────────────
AGENTS_INSTALLED=0
if [[ "$AGENT" == "opencode" && -n "$AGENTS_DIR" ]]; then
  echo ""
  info "Installing OpenCode agents to: $AGENTS_DIR"
  mkdir -p "$AGENTS_DIR"

  for agent_file in "$AGENTS_SRC"/*.md; do
    [[ -f "$agent_file" ]] || continue
    agent_name="$(basename "$agent_file")"
    cp "$agent_file" "$AGENTS_DIR/$agent_name"
    ok "  ✓ $agent_name"
    ((AGENTS_INSTALLED++))
  done

  echo -e "  → ${GREEN}${AGENTS_INSTALLED} agents installed${NC}"
elif [[ "$AGENT" != "opencode" ]]; then
  echo ""
  warn "Skipping agent-specific install (no custom agents for ${AGENT} in this repo)"
fi

# ─── Summary ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}────────────────────────────────────────${NC}"
echo -e "${GREEN}${BOLD}Installation complete!${NC}"
echo -e "${BOLD}────────────────────────────────────────${NC}"
echo ""
echo -e "  Agent:   ${CYAN}${AGENT}${NC}"
echo -e "  Scope:   ${CYAN}${SCOPE}${NC}"
echo -e "  Skills:  ${GREEN}${SKILLS_INSTALLED}${NC} installed → ${CYAN}${SKILLS_DIR}${NC}"
if [[ "$AGENT" == "opencode" && -n "$AGENTS_DIR" ]]; then
  echo -e "  Agents:  ${GREEN}${AGENTS_INSTALLED}${NC} installed → ${CYAN}${AGENTS_DIR}${NC}"
fi
echo ""
