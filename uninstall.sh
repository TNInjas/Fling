#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./uninstall.sh [--dry-run] [--force] [--config-dir DIR]

Options:
  --dry-run          Preview removal without changing files.
  --force            Also remove managed files modified after installation.
  --config-dir DIR   Antigravity config directory (default: $HOME/.gemini/config).
  -h, --help         Show this help.

By default, a file is removed only if it exactly matches this package's source.
EOF
}

[[ -n "${HOME:-}" ]] || { echo 'ERROR: HOME is not set.' >&2; exit 1; }
SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${ANTIGRAVITY_CONFIG_DIR:-${HOME}/.gemini/config}"
DRY_RUN=0
FORCE=0

while (($#)); do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --force) FORCE=1; shift ;;
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

remove_targets=()
modified_targets=()
for pair in "rules|$RULES_SOURCE|$RULES_TARGET" "skill|$SKILL_SOURCE|$SKILL_TARGET"; do
  IFS='|' read -r label source target <<< "$pair"
  if [[ ! -e "$target" && ! -L "$target" ]]; then
    continue
  elif [[ -L "$target" || ! -f "$target" ]]; then
    echo "ERROR: Refusing to remove a non-regular or symbolic-link target: $target" >&2
    exit 1
  elif [[ ! -f "$source" || ! -s "$source" ]]; then
    echo "ERROR: Package source missing; cannot verify $target" >&2
    exit 1
  elif cmp -s -- "$source" "$target"; then
    remove_targets+=("$target")
  else
    modified_targets+=("$target")
  fi
done

if ((${#modified_targets[@]})) && (( ! FORCE )); then
  echo 'REFUSING to remove modified files:' >&2
  printf '  %s\n' "${modified_targets[@]}" >&2
  echo 'Review them manually. Use --force only if you intentionally want to delete those edits.' >&2
  exit 1
fi
if ((FORCE)); then
  remove_targets+=("${modified_targets[@]}")
fi

if ((${#remove_targets[@]} == 0)); then
  echo 'No managed files found to remove.'
  exit 0
fi

if ((DRY_RUN)); then
  echo 'DRY RUN - no files changed. Would remove:'
  printf '  %s\n' "${remove_targets[@]}"
  exit 0
fi

for target in "${remove_targets[@]}"; do
  rm -f -- "$target"
  printf 'Removed: %s\n' "$target"
done
rmdir -- "$SKILL_DIR" 2>/dev/null || true
echo 'Uninstallation complete. Parent configuration directories and unrelated files were preserved.'
