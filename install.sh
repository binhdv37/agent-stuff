#!/usr/bin/env bash
# ============================================================================
#  Agent Stuff — Skills Installer
#  Usage: curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/install.sh | bash
# ============================================================================
set -uo pipefail

# ---------------------------------------------------------------------------
# CONFIG — update these 3 lines for your repo
# ---------------------------------------------------------------------------
REPO_OWNER="binhdv37"
REPO_NAME="agent-stuff"
BRANCH="main"
SKILLS_SUBDIR="skills"           # skills/<skill-name>/SKILL.md
OPENCODE_AGENTS_SUBDIR="opencode/agents"   # opencode/agents/<name>.md
OPENCODE_COMMANDS_SUBDIR="opencode/commands" # opencode/commands/<name>.md
# ---------------------------------------------------------------------------

# ---------------------------- Colors ---------------------------------------
if [ -t 1 ]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  CYAN=$(tput setaf 6); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3)
  RED=$(tput setaf 1); GRAY=$(tput setaf 7)
else
  BOLD=""; DIM=""; RESET=""; CYAN=""; GREEN=""; YELLOW=""; RED=""; GRAY=""
fi

TMP_DIR=""
cleanup() {
  show_cursor
  [ -n "$TMP_DIR" ] && rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

hide_cursor() { tput civis 2>/dev/null || true; }
show_cursor() { tput cnorm 2>/dev/null || true; }

clear_lines() {
  local n="$1" i
  for ((i = 0; i < n; i++)); do
    tput cuu1 2>/dev/null || true
    printf '\r'
    tput el 2>/dev/null || true
  done
}

# ---------------------------- Logo ------------------------------------------
print_logo() {
  local logo=(
"    _                    _     ____  _         __  __ "
"   / \\   __ _  ___ _ __ | |_  / ___|| |_ _   _ / _|/ _|"
"  / _ \\ / _\` |/ _ \\ '_ \\| __| \\___ \\| __| | | | |_| |_ "
" / ___ \\ (_| |  __/ | | | |_   ___) | |_| |_| |  _|  _|"
"/_/   \\_\\__, |\\___|_| |_|\\__| |____/ \\__|\\__,_|_| |_|  "
"        |___/                                          "
  )
  echo
  for line in "${logo[@]}"; do
    printf '%s%s%s%s\n' "$CYAN" "$BOLD" "$line" "$RESET"
    sleep 0.04
  done
  printf '%s  the good stuff for your AI agent%s\n' "$DIM" "$RESET"
  echo
  sleep 0.15
}

# ---------------------- Single-select menu -----------------------------------
# Usage: select_option "Title" "opt1" "opt2" ...
# Result: SELECTED_INDEX (0-based)
select_option() {
  local title="$1"; shift
  local options=("$@")
  local count=${#options[@]}
  local selected=0
  local key rest

  printf '%s%s%s\n\n' "$BOLD" "$title" "$RESET"

  draw() {
    local i
    for i in "${!options[@]}"; do
      if [ "$i" -eq "$selected" ]; then
        printf '  %s❯ %s%s\n' "$GREEN" "${options[$i]}" "$RESET"
      else
        printf '    %s\n' "${options[$i]}"
      fi
    done
  }

  draw
  hide_cursor
  while true; do
    IFS= read -rsn1 key < /dev/tty
    if [[ $key == $'\x1b' ]]; then
      IFS= read -rsn2 rest < /dev/tty
      case "$rest" in
        '[A') selected=$((selected - 1)); [ "$selected" -lt 0 ] && selected=$((count - 1)) ;;
        '[B') selected=$((selected + 1)); [ "$selected" -ge "$count" ] && selected=0 ;;
      esac
    elif [[ -z "$key" ]]; then
      break
    fi
    clear_lines "$count"
    draw
  done
  show_cursor
  echo
  SELECTED_INDEX=$selected
}

# ---------------------------- Main -------------------------------------------
main() {
  if [ ! -e /dev/tty ]; then
    printf '%sThis installer needs an interactive terminal (arrow-key menus).%s\n' "$RED" "$RESET"
    printf 'Download and run it directly instead:\n'
    printf '  curl -fsSL https://raw.githubusercontent.com/%s/%s/%s/install.sh -o install.sh\n' "$REPO_OWNER" "$REPO_NAME" "$BRANCH"
    printf '  bash install.sh\n'
    exit 1
  fi

  clear 2>/dev/null || true
  print_logo

  # --- Supported agents & their skill paths (verified against official docs) ---
  local AGENT_NAMES=(
    "Claude Code"
    "OpenCode"
    "Codex CLI"
  )
  local AGENT_GLOBAL_SKILLS_DIRS=(
    "$HOME/.claude/skills"
    "$HOME/.config/opencode/skills"
    "$HOME/.agents/skills"
  )
  local AGENT_LOCAL_SKILLS_DIRS=(
    ".claude/skills"
    ".opencode/skills"
    ".agents/skills"
  )
  # All 3 support both global and personal + project-scoped skills
  local AGENT_SUPPORTS_GLOBAL=(1 1 1)

  # 1) Choose agent
  select_option "Which AI coding agent are you using?" "${AGENT_NAMES[@]}"
  local AGENT_IDX=$SELECTED_INDEX
  local AGENT_NAME="${AGENT_NAMES[$AGENT_IDX]}"

  # 2) Choose install mode
  local MODE_IDX
  if [ "${AGENT_SUPPORTS_GLOBAL[$AGENT_IDX]}" -eq 1 ]; then
    select_option "Where do you want to install?" \
      "Global — available in every project (${AGENT_GLOBAL_SKILLS_DIRS[$AGENT_IDX]})" \
      "Local — this project only ($(pwd)/${AGENT_LOCAL_SKILLS_DIRS[$AGENT_IDX]})"
    MODE_IDX=$SELECTED_INDEX
  else
    MODE_IDX=1
    printf '%s%s only supports local (project-scoped) installs. Switching to Local.%s\n\n' "$YELLOW" "$AGENT_NAME" "$RESET"
  fi

  local SKILLS_TARGET_DIR
  if [ "$MODE_IDX" -eq 0 ]; then
    SKILLS_TARGET_DIR="${AGENT_GLOBAL_SKILLS_DIRS[$AGENT_IDX]}"
  else
    SKILLS_TARGET_DIR="$(pwd)/${AGENT_LOCAL_SKILLS_DIRS[$AGENT_IDX]}"
  fi
  printf '%s-> Skills will be installed to: %s%s\n\n' "$DIM" "$SKILLS_TARGET_DIR" "$RESET"

  # If OpenCode, also resolve the custom agents target dir
  local OPENCODE_AGENTS_TARGET_DIR=""
  if [ "$AGENT_IDX" -eq 1 ]; then
    if [ "$MODE_IDX" -eq 0 ]; then
      OPENCODE_AGENTS_TARGET_DIR="$HOME/.config/opencode/agents"
    else
      OPENCODE_AGENTS_TARGET_DIR="$(pwd)/.opencode/agents"
    fi
    printf '%s-> Custom agents will be installed to: %s%s\n\n' "$DIM" "$OPENCODE_AGENTS_TARGET_DIR" "$RESET"
  fi

  # If OpenCode, also resolve the custom commands target dir
  local OPENCODE_COMMANDS_TARGET_DIR=""
  if [ "$AGENT_IDX" -eq 1 ]; then
    if [ "$MODE_IDX" -eq 0 ]; then
      OPENCODE_COMMANDS_TARGET_DIR="$HOME/.config/opencode/commands"
    else
      OPENCODE_COMMANDS_TARGET_DIR="$(pwd)/.opencode/commands"
    fi
    printf '%s-> Custom commands will be installed to: %s%s\n\n' "$DIM" "$OPENCODE_COMMANDS_TARGET_DIR" "$RESET"
  fi

  # 3) Download the repo
  printf '%sFetching skills from %s/%s...%s\n' "$CYAN" "$REPO_OWNER" "$REPO_NAME" "$RESET"
  TMP_DIR=$(mktemp -d)
  local TARBALL_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/archive/refs/heads/${BRANCH}.tar.gz"

  if ! curl -fsSL "$TARBALL_URL" -o "$TMP_DIR/repo.tar.gz"; then
    printf '%sFailed to download the repo. Check your network connection or the REPO_OWNER/REPO_NAME/BRANCH values in this script.%s\n' "$RED" "$RESET"
    exit 1
  fi
  tar -xzf "$TMP_DIR/repo.tar.gz" -C "$TMP_DIR"

  local SRC_ROOT
  SRC_ROOT=$(find "$TMP_DIR" -maxdepth 1 -type d -name "${REPO_NAME}-*" | head -n1)
  local SKILLS_SRC="${SRC_ROOT}/${SKILLS_SUBDIR}"

  if [ ! -d "$SKILLS_SRC" ]; then
    printf '%sCould not find the "%s" directory in the repo.%s\n' "$RED" "$SKILLS_SUBDIR" "$RESET"
    exit 1
  fi

  local SKILL_LIST=()
  while IFS= read -r -d '' d; do
    SKILL_LIST+=("$(basename "$d")")
  done < <(find "$SKILLS_SRC" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z)

  if [ ${#SKILL_LIST[@]} -eq 0 ]; then
    printf '%sNo skills found in "%s".%s\n' "$RED" "$SKILLS_SUBDIR" "$RESET"
    exit 1
  fi

  # 4) Install all skills
  mkdir -p "$SKILLS_TARGET_DIR"
  echo
  printf '%sInstalling %d skill(s):%s\n' "$BOLD" "${#SKILL_LIST[@]}" "$RESET"
  local name
  for name in "${SKILL_LIST[@]}"; do
    rm -rf "${SKILLS_TARGET_DIR:?}/${name}"
    cp -r "${SKILLS_SRC}/${name}" "${SKILLS_TARGET_DIR}/${name}"
    printf '  %s✔%s %s\n' "$GREEN" "$RESET" "$name"
  done

  # 5) If OpenCode, also install custom agents
  if [ "$AGENT_IDX" -eq 1 ]; then
    local AGENTS_SRC="${SRC_ROOT}/${OPENCODE_AGENTS_SUBDIR}"
    if [ -d "$AGENTS_SRC" ]; then
      local AGENT_FILES=()
      while IFS= read -r -d '' f; do
        AGENT_FILES+=("$(basename "$f")")
      done < <(find "$AGENTS_SRC" -mindepth 1 -maxdepth 1 -type f -name "*.md" -print0 | sort -z)

      if [ ${#AGENT_FILES[@]} -gt 0 ]; then
        mkdir -p "$OPENCODE_AGENTS_TARGET_DIR"
        echo
        printf '%sInstalling %d custom agent(s):%s\n' "$BOLD" "${#AGENT_FILES[@]}" "$RESET"
        local f
        for f in "${AGENT_FILES[@]}"; do
          cp -f "${AGENTS_SRC}/${f}" "${OPENCODE_AGENTS_TARGET_DIR}/${f}"
          printf '  %s✔%s %s\n' "$GREEN" "$RESET" "$f"
        done
      fi
    else
      printf '\n%sNote: no "%s" directory found in the repo, skipping custom agents.%s\n' "$YELLOW" "$OPENCODE_AGENTS_SUBDIR" "$RESET"
    fi
  fi

  # 6) If OpenCode, also install custom commands
  if [ "$AGENT_IDX" -eq 1 ]; then
    local COMMANDS_SRC="${SRC_ROOT}/${OPENCODE_COMMANDS_SUBDIR}"
    if [ -d "$COMMANDS_SRC" ]; then
      local COMMAND_FILES=()
      while IFS= read -r -d '' f; do
        COMMAND_FILES+=("$(basename "$f")")
      done < <(find "$COMMANDS_SRC" -mindepth 1 -maxdepth 1 -type f -name "*.md" -print0 | sort -z)

      if [ ${#COMMAND_FILES[@]} -gt 0 ]; then
        mkdir -p "$OPENCODE_COMMANDS_TARGET_DIR"
        echo
        printf '%sInstalling %d custom command(s):%s\n' "$BOLD" "${#COMMAND_FILES[@]}" "$RESET"
        local f
        for f in "${COMMAND_FILES[@]}"; do
          cp -f "${COMMANDS_SRC}/${f}" "${OPENCODE_COMMANDS_TARGET_DIR}/${f}"
          printf '  %s✔%s %s\n' "$GREEN" "$RESET" "$f"
        done
      fi
    else
      printf '\n%sNote: no "%s" directory found in the repo, skipping custom commands.%s\n' "$YELLOW" "$OPENCODE_COMMANDS_SUBDIR" "$RESET"
    fi
  fi

  echo
  printf '%s%sDone!%s\n' "$GREEN" "$BOLD" "$RESET"
  printf '%sInstalled into: %s%s\n' "$DIM" "$SKILLS_TARGET_DIR" "$RESET"
  [ -n "$OPENCODE_AGENTS_TARGET_DIR" ] && printf '%sCustom agents:  %s%s\n' "$DIM" "$OPENCODE_AGENTS_TARGET_DIR" "$RESET"
  [ -n "$OPENCODE_COMMANDS_TARGET_DIR" ] && printf '%sCustom commands: %s%s\n' "$DIM" "$OPENCODE_COMMANDS_TARGET_DIR" "$RESET"
  printf '%s-> Restart %s to pick up the new skills.%s\n' "$DIM" "$AGENT_NAME" "$RESET"
}

main
