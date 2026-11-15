# Installation and removal

## Supported installation route

The supplied shell scripts target an Antigravity configuration directory at `~/.gemini/config/`. The reference environment tested for this release is Linux with Antigravity CLI 1.5.9.

From a clone or extracted release archive:

```bash
./install.sh --dry-run
./install.sh
```

Restart Antigravity CLI and start a fresh session. Verify that the global operating rules and `universal-engineering` skill are discoverable before relying on them.

## Installed files

| Source | Destination |
|---|---|
| `global/AGENTS.md` | `~/.gemini/config/AGENTS.md` |
| `skills/universal-engineering/SKILL.md` | `~/.gemini/config/skills/universal-engineering/SKILL.md` |

The installer does not modify `config.json`, MCP configuration, plugin settings, project repositories, or other skills.

## Custom configuration directory

Use `--config-dir`:

```bash
./install.sh --dry-run --config-dir "$HOME/.gemini/config"
./install.sh --config-dir "$HOME/.gemini/config"
```

Or set the environment variable:

```bash
ANTIGRAVITY_CONFIG_DIR="$HOME/.gemini/config" ./install.sh
```

## Existing files

The installer checks both destinations before writing anything. If either destination already exists, installation stops. It will not merge, replace, or overwrite existing content. Review the existing file and integrate the workflow manually if needed.

## Dry run

`--dry-run` reports the target paths and performs no writes. It is safe to run repeatedly.

## Uninstallation

Run from the same package checkout or archive:

```bash
./uninstall.sh --dry-run
./uninstall.sh
```

By default, the uninstaller removes only files whose contents exactly match the package sources. It leaves modified files untouched and exits with a warning. To deliberately remove modified managed files, use `--force` after reviewing the targets:

```bash
./uninstall.sh --force
```

The uninstaller removes the now-empty `universal-engineering` skill directory if possible. It does not remove parent configuration directories or unrelated files.

## Manual removal

If the package source files are unavailable, manually inspect and remove only these two files if they belong to this installation:

```text
~/.gemini/config/AGENTS.md
~/.gemini/config/skills/universal-engineering/SKILL.md
```

Do not delete a file that contains unrelated rules or user modifications without reviewing it first.

## After installation

1. Restart Antigravity CLI.
2. Open a new session.
3. Ask it to identify the Universal Engineering Workflow instructions and skill.
4. Ask it to explain the authority boundaries and when EGM should be used.
5. Confirm its response reflects the installed files. Then use the workflow on a real task and observe whether the behaviour matches expectations.

The fact that a file is installed does not prove that every instruction is enforced in every situation.
