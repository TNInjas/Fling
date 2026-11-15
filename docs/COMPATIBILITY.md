# Compatibility and verification

## Verified reference environment

| Component | Status |
|---|---|
| Linux shell environment | Tested |
| Antigravity CLI 1.5.9 | Tested |
| Global rules at `~/.gemini/config/AGENTS.md` | Loaded and recognized in a fresh CLI session |
| Skill at `~/.gemini/config/skills/universal-engineering/SKILL.md` | Read and recognized in a fresh CLI session |
| EGM plugin integration | Guidance included; exact command availability must be checked per installed plugin version |
| CodeRabbit integration | Guidance included; invocation and external-service permissions must be checked in the user's environment |

## Not yet verified by this release

- Windows-native installation or PowerShell support.
- macOS installation.
- Other Antigravity CLI versions or alternate global configuration layouts.
- Every EGM command name across plugin versions.
- A specific CodeRabbit CLI command or automated review flow.
- Guaranteed instruction-following, independent asynchronous operation, or fresh-context reviewer behaviour.

## Capability boundary

The package provides instructions, skill content, templates, and installation scripts. It does not install Antigravity CLI, EGM, CodeRabbit, MCP servers, agents, models, or external services. It cannot create permissions the CLI does not grant, enforce every instruction, or guarantee that a tool will be invoked.

Before relying on a capability, confirm that it exists and is authorized in the current environment. The agent must report unavailable integrations honestly and must not claim a test or review was performed unless it actually happened.

## Reporting compatibility

When reporting a successful installation or bug, include:

- Operating system and version.
- Shell and version.
- Antigravity CLI version.
- Package version.
- EGM and CodeRabbit plugin versions, if relevant.
- Sanitized command output and exact steps.

Never include API keys, credentials, private project contents, or personal data in public reports.
