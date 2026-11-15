#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./install.sh [--dry-run] [--config-dir DIR]

Options:
  --dry-run          Preview target paths without changing files.
  --config-dir DIR   Antigravity config directory (default: $HOME/.gemini/config).
  -h, --help         Show this help.

Installs only:
  <config-dir>/AGENTS.md
  <config-dir>/skills/universal-engineering/SKILL.md

Existing targets are never overwritten. The script does not modify plugin,
MCP, project, or other skill configuration.
EOF
}

[[ -n "${HOME:-}" ]] || { echo 'ERROR: HOME is not set.' >&2; exit 1; }
SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${ANTIGRAVITY_CONFIG_DIR:-${HOME}/.gemini/config}"
DRY_RUN=0

while (($#)); do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --config-dir)
      (($# >= 2)) || { echo 'ERROR: --config-dir requires a directory.' >&2; exit 2; }
      CONFIG_DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n "$CONFIG_DIR" ]] || { echo 'ERROR: configuration directory must not be empty.' >&2; exit 2; }

RULES_SOURCE="$SOURCE_DIR/global/AGENTS.md"
SKILL_SOURCE="$SOURCE_DIR/skills/universal-engineering/SKILL.md"
RULES_TARGET="$CONFIG_DIR/AGENTS.md"
SKILL_DIR="$CONFIG_DIR/skills/universal-engineering"
SKILL_TARGET="$SKILL_DIR/SKILL.md"

for source in "$RULES_SOURCE" "$SKILL_SOURCE"; do
  [[ -s "$source" ]] || { echo "ERROR: Required package file is missing or empty: $source" >&2; exit 1; }
done

conflicts=()
for target in "$RULES_TARGET" "$SKILL_TARGET"; do
  if [[ -e "$target" || -L "$target" ]]; then conflicts+=("$target"); fi
done
if ((${#conflicts[@]})); then
  printf 'CONFLICT: target already exists: %s\n' "${conflicts[@]}" >&2
  echo 'Nothing was installed. Review existing files and merge manually if appropriate.' >&2
  exit 1
fi

if ((DRY_RUN)); then
  echo 'DRY RUN - no files changed.'
  printf 'Would install:\n  %s\n  %s\n' "$RULES_TARGET" "$SKILL_TARGET"
  exit 0
fi

created_rules=0
created_skill=0
cleanup_on_error() {
  status=$?
  if ((status != 0)); then
    ((created_skill)) && rm -f -- "$SKILL_TARGET"
    ((created_rules)) && rm -f -- "$RULES_TARGET"
    echo 'Installation failed; any files created by this run were rolled back where possible.' >&2
  fi
  exit "$status"
}
trap cleanup_on_error EXIT

mkdir -p -- "$CONFIG_DIR" "$SKILL_DIR"
install -m 0644 -- "$RULES_SOURCE" "$RULES_TARGET"
created_rules=1
install -m 0644 -- "$SKILL_SOURCE" "$SKILL_TARGET"
created_skill=1
cmp -s -- "$RULES_SOURCE" "$RULES_TARGET"
cmp -s -- "$SKILL_SOURCE" "$SKILL_TARGET"

trap - EXIT
echo 'Installation successful.'
printf 'Global rules: %s\nUniversal skill: %s\n' "$RULES_TARGET" "$SKILL_TARGET"
echo 'Restart Antigravity CLI and verify the workflow in a fresh session.'
