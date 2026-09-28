#!/usr/bin/env bash
# Run the adapter CLI from a local checkout. See README.md for installation.
set -euo pipefail

SOURCE_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ ! -f "$SOURCE_ROOT/package.json" || ! -d "$SOURCE_ROOT/core" ]]; then
  printf 'Run install.sh from an agent-stuff checkout. See the repository README.\n' >&2
  exit 1
fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  printf 'Node.js 22 or newer and npm are required.\n' >&2
  exit 1
fi
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("Node.js 22 or newer is required"); process.exit(1); }'
if [[ ! -d "$SOURCE_ROOT/node_modules" ]]; then
  npm --prefix "$SOURCE_ROOT" ci
fi
npm --prefix "$SOURCE_ROOT" run build
if [[ $# -eq 0 || "$1" == --* ]]; then
  set -- install "$@"
fi
exec node "$SOURCE_ROOT/dist/tool/src/cli.js" "$@"
