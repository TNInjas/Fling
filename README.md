# Universal Engineering Workflow for Antigravity CLI

**Human-directed. Agent-executed. Independently verified.**

A reusable, adaptive engineering workflow for Antigravity CLI. It helps an agent act as a research partner, critical reviewer, implementation assistant, and verification partner while keeping engineering decisions and consequential approvals with the human.

The workflow specification is **Version 1.1**. This repository is the first public distribution package, **v1.1.0**.

## What it provides

- **Global operating rules** for role boundaries, instruction precedence, task triage, approvals, resource efficiency, Git permissions, and delivery.
- **A reusable skill** that describes the complete workflow for research, planning, implementation, QA, debugging, user feedback, and shipping.
- **Specialized task flows** for new projects, features, bug fixing, research, refactoring, security reviews, maintenance, performance optimization, and GitHub contributions.
- **EGM and CodeRabbit integration guidance** that treats these as optional capabilities and requires the agent to verify that they are actually available.
- **Project and task templates** for project-specific instructions, active task state, and session handover.
- The original 20-page **Version 1.1 workflow specification PDF**, included unchanged.

## Operating principle

The human is the engineering lead. The agent investigates, challenges assumptions, researches, plans, implements approved work, and verifies results. It must not quietly replace the user's decisions or execute unapproved recommendations.

The workflow adapts to task complexity:

| Tier | Examples | Expected process |
|---|---|---|
| **Light** | Simple question, typo, isolated low-risk fix | State intent, perform the requested low-risk work, run a relevant check, report. Skip unnecessary ceremony. |
| **Standard** | Feature, unclear bug, moderate refactor | Inspect context, analyze, propose a concise plan, obtain approval, implement incrementally, verify. |
| **High-risk / complex** | New project, architectural change, security-sensitive work, data migration, public API or irreversible operation | Deeper research and specification, explicit approvals, milestone reviews, independent verification where available. |

## Quick start

### Requirements

- Antigravity CLI with its configuration directory under `~/.gemini/config/`.
- Bash and standard Unix utilities (`mkdir`, `install`, `cmp`, `rm`, `rmdir`).
- EGM and CodeRabbit are optional integrations. They are **not installed or configured by this package**.

### Install

Clone this repository or extract a release archive, then run:

```bash
./install.sh --dry-run
./install.sh
```

Restart Antigravity CLI after installation and begin a fresh session. The installer places:

```text
~/.gemini/config/AGENTS.md
~/.gemini/config/skills/universal-engineering/SKILL.md
```

The installer refuses to overwrite either target. If either file already exists, it stops and asks you to resolve the conflict manually. It does not change plugin configuration, MCP settings, project files, or existing plugins.

For a non-default configuration directory:

```bash
./install.sh --dry-run --config-dir "$HOME/.gemini/config"
./install.sh --config-dir "$HOME/.gemini/config"
```

You can also set `ANTIGRAVITY_CONFIG_DIR` instead of passing `--config-dir`.

### Uninstall

Run the uninstaller from the same repository checkout or extracted release archive:

```bash
./uninstall.sh --dry-run
./uninstall.sh
```

The uninstaller removes only the two managed files and only when their contents still match the package. If a file has been edited, it refuses to delete it. `--force` is available for users who explicitly choose to remove modified managed files:

```bash
./uninstall.sh --force
```

It does not delete the whole Antigravity configuration directory or unrelated files.

## How to use the workflow

After restarting Antigravity CLI, give it a real engineering or technical-research task. For substantial work, the `universal-engineering` skill should guide it to:

1. Classify the task and understand the full context.
2. Inspect relevant project information and identify ambiguity.
3. Challenge assumptions and research when necessary.
4. Prepare an appropriately sized plan and obtain approval before significant implementation.
5. Implement in small logical steps with continuous QA.
6. Validate bugs, security, regressions, and final delivery.
7. Report what was changed, tested, shipped, and left unresolved.

The workflow is not intended to force a heavyweight process onto every trivial request.

## Integrations

### EGM

The workflow describes selective use of EGM for brainstorming, specifications, reviews, issue resolution, codebase understanding, and documentation drift checks. The source specification uses the `/egm:` command convention as an example, but the actual commands must be checked against the installed EGM plugin version before use.

### CodeRabbit

CodeRabbit can provide independent code review where it is installed, authorized, and appropriate. This package does not assume a particular CodeRabbit CLI invocation, enable the plugin, or send source code to an external service automatically.

See [`docs/PLUGIN-INTEGRATION.md`](docs/PLUGIN-INTEGRATION.md).

## Compatibility and verification status

The installation layout and behaviour were exercised on **Linux with Antigravity CLI 1.5.9**. This is the verified reference environment, not a claim of universal compatibility. Other CLI versions, operating systems, custom configuration locations, and plugin versions should be tested before relying on the package.

See [`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md) for the boundaries and manual checks.

## Repository map

```text
.
├── global/AGENTS.md
├── skills/universal-engineering/SKILL.md
├── templates/
│   ├── project-agent/AGENTS.md
│   └── task-artifacts/
├── docs/
│   ├── Universal Engineering Workflow for Antigravity CLI.pdf
│   ├── INSTALLATION.md
│   ├── COMPATIBILITY.md
│   ├── ARCHITECTURE.md
│   └── PLUGIN-INTEGRATION.md
├── tests/test-install.sh
├── install.sh
└── uninstall.sh
```

## Design constraints

- The workflow is an **operating specification**, not an enforcement engine.
- A skill can guide agent behaviour; it cannot guarantee that every instruction will be followed.
- EGM, CodeRabbit, subagents, asynchronous operations, and fresh-context reviewers must be verified in the actual environment before relying on them.
- The agent must never claim to have used a tool, reviewer, test, or integration unless it actually did.
- Tool access and permission controls remain governed by the installed Antigravity CLI and the user's configuration.

## Contributing

Bug reports, compatibility reports, documentation fixes, and carefully scoped improvements are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.

## License

This project is licensed under the MIT License. See [`LICENSE`](LICENSE).
