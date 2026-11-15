#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

CONFIG_DIR="$TMP_ROOT/config with spaces"
RULES_TARGET="$CONFIG_DIR/AGENTS.md"
SKILL_TARGET="$CONFIG_DIR/skills/universal-engineering/SKILL.md"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

# Dry-run must not create the configuration directory.
"$ROOT_DIR/install.sh" --dry-run --config-dir "$CONFIG_DIR" >/dev/null
[[ ! -e "$CONFIG_DIR" ]] || fail "dry-run created the configuration directory"
pass "installer dry-run makes no filesystem changes"

# Empty paths must be rejected rather than resolving to filesystem root.
if "$ROOT_DIR/install.sh" --config-dir "" >/dev/null 2>&1; then
  fail "installer accepted an empty config directory"
fi
if "$ROOT_DIR/uninstall.sh" --config-dir "" >/dev/null 2>&1; then
  fail "uninstaller accepted an empty config directory"
fi
pass "empty configuration paths are rejected"

# Environment override should select the requested config directory.
ENV_CONFIG="$TMP_ROOT/env-config"
ANTIGRAVITY_CONFIG_DIR="$ENV_CONFIG" "$ROOT_DIR/install.sh" --dry-run >/dev/null
[[ ! -e "$ENV_CONFIG" ]] || fail "environment-variable dry-run created files"
pass "ANTIGRAVITY_CONFIG_DIR override is honoured in dry-run mode"

# Fresh installation must create the two expected files with exact content.
"$ROOT_DIR/install.sh" --config-dir "$CONFIG_DIR" >/dev/null
cmp -s "$ROOT_DIR/global/AGENTS.md" "$RULES_TARGET" || fail "global rules differ after install"
cmp -s "$ROOT_DIR/skills/universal-engineering/SKILL.md" "$SKILL_TARGET" || fail "skill differs after install"
pass "fresh install writes both expected files"

# Reinstall must refuse to overwrite existing files.
if "$ROOT_DIR/install.sh" --config-dir "$CONFIG_DIR" >/dev/null 2>&1; then
  fail "installer did not refuse existing targets"
fi
cmp -s "$ROOT_DIR/global/AGENTS.md" "$RULES_TARGET" || fail "conflict check changed global rules"
cmp -s "$ROOT_DIR/skills/universal-engineering/SKILL.md" "$SKILL_TARGET" || fail "conflict check changed skill"
pass "installer refuses to overwrite existing targets"

# Uninstaller dry-run must preserve files.
"$ROOT_DIR/uninstall.sh" --dry-run --config-dir "$CONFIG_DIR" >/dev/null
[[ -f "$RULES_TARGET" && -f "$SKILL_TARGET" ]] || fail "uninstall dry-run removed files"
pass "uninstaller dry-run makes no filesystem changes"

# Modified file must be protected; the unchanged peer should also remain.
printf '\n# local customization\n' >> "$RULES_TARGET"
if "$ROOT_DIR/uninstall.sh" --config-dir "$CONFIG_DIR" >/dev/null 2>&1; then
  fail "uninstaller did not refuse modified managed files"
fi
[[ -f "$RULES_TARGET" && -f "$SKILL_TARGET" ]] || fail "safe uninstall unexpectedly removed a file"
pass "uninstaller protects locally modified files"

# Force removal is explicit and should remove only the two managed files.
"$ROOT_DIR/uninstall.sh" --force --config-dir "$CONFIG_DIR" >/dev/null
[[ ! -e "$RULES_TARGET" && ! -e "$SKILL_TARGET" ]] || fail "force uninstall left managed files"
[[ -d "$CONFIG_DIR" ]] || fail "uninstaller removed the parent configuration directory"
pass "explicit force uninstall removes managed files and preserves parent config"

# Uninstaller must not follow or remove symbolic-link targets.
SYMLINK_CONFIG="$TMP_ROOT/symlink-config"
OUTSIDE_FILE="$TMP_ROOT/outside-file"
mkdir -p "$SYMLINK_CONFIG/skills/universal-engineering"
printf 'preserve this file\n' > "$OUTSIDE_FILE"
ln -s "$OUTSIDE_FILE" "$SYMLINK_CONFIG/AGENTS.md"
if "$ROOT_DIR/uninstall.sh" --force --config-dir "$SYMLINK_CONFIG" >/dev/null 2>&1; then
  fail "uninstaller accepted a symbolic-link target"
fi
[[ -L "$SYMLINK_CONFIG/AGENTS.md" && -f "$OUTSIDE_FILE" ]] || fail "uninstaller changed a symbolic link target"
pass "uninstaller refuses symbolic-link targets"

echo "All package smoke tests passed."
