# Optional plugin integration

This package does not install, enable, disable, configure, or update plugins. The workflow can use existing integrations when they are available, authorized, and useful.

## EGM

The source specification describes these EGM capabilities:

- `egm-brainstorm`
- `egm-draft`
- `egm-review`
- `egm-resolve`
- `egm-review-loop`
- `egm-bootstrap`
- `egm-drift-report`

The specification gives the `/egm:` prefix as an expected invocation convention (for example, `/egm:egm-brainstorm`). This must be checked against the installed plugin's actual command surface and version. Do not assume the command exists merely because it appears in documentation.

Use EGM selectively for unclear ideas, significant specifications, architecture decisions, independent review, unfamiliar codebases, and documentation drift. Do not run it automatically for every task. EGM structures research and reviews; it does not replace primary-source research, experiments, tests, or engineering judgment.

## CodeRabbit

Use the installed CodeRabbit review capability where appropriate, especially after meaningful implementation milestones and before delivery. Its findings are advisory and must be validated before changes are made.

This package deliberately does not prescribe a CLI command. Check the installed integration, version, and project configuration. Ask before sending code or data to an external service unless the service is already approved for that project.

## Other tools and agents

Reuse existing Agent Skills, test/security agents, linters, debuggers, profilers, and project-native tools when they add value. Avoid redundant reviewers or parallel work that duplicates effort.

## Capability honesty

If EGM, CodeRabbit, a reviewer, an asynchronous operation, or a test is unavailable or not run, state that clearly. Use a suitable manual fallback when appropriate. Never report a review, test, or integration action as completed unless it actually occurred.
