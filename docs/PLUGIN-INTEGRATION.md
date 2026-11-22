# Optional plugin integration

This package does not install, enable, disable, configure, or update plugins by default. The workflow can leverage external plugins and skills when they are installed, authorized, and useful.

## 1. Elephant & Goldfish Model (EGM)

- **Repository:** [`https://github.com/google/elephant-goldfish-model`](https://github.com/google/elephant-goldfish-model)
- **Antigravity CLI Installation:**
  ```bash
  agy plugin install https://github.com/google/elephant-goldfish-model
  ```

### Capabilities
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

## 2. CodeRabbit

- **Agent Skills Plugin Repository:** [`https://github.com/coderabbitai/skills`](https://github.com/coderabbitai/skills)
- **CLI Documentation & Binary:** [`https://github.com/coderabbitai/coderabbit-cli`](https://github.com/coderabbitai/coderabbit-cli)
- **Setup & Authentication:**
  ```bash
  # 1. Install CodeRabbit CLI
  curl -fsSL https://coderabbit.ai/install.sh | sh
  # (Alternatively via Homebrew: brew install coderabbitai/tap/coderabbit)

  # 2. Authenticate CLI session
  coderabbit login

  # 3. Install CodeRabbit Agent Skills Plugin in Antigravity
  agy plugin install https://github.com/coderabbitai/skills
  ```

### Usage
Use the installed CodeRabbit review capability where appropriate, especially after meaningful implementation milestones and before delivery. Its findings are advisory and must be validated before changes are made.

Always check the installed integration, version, and project configuration. Ask before sending code or data to an external service unless the service is already approved for that project.

## 3. Ponytail (Minimalist Methodology)

- **Repository:** [`https://github.com/DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail)
- **Antigravity CLI Installation:**
  ```bash
  agy plugin install https://github.com/DietrichGebert/ponytail
  ```

## 4. Agent Skills (Addy Osmani)

- **Repository:** [`https://github.com/addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills)
- **Antigravity CLI Installation:**
  ```bash
  agy plugin install https://github.com/addyosmani/agent-skills
  ```

## 5. Other tools and agents

Reuse existing Agent Skills, test/security agents, linters, debuggers, profilers, and project-native tools when they add value. Avoid redundant reviewers or parallel work that duplicates effort.

## 6. Capability honesty

If EGM, CodeRabbit, a reviewer, an asynchronous operation, or a test is unavailable or not run, state that clearly. Use a suitable manual fallback when appropriate. Never report a review, test, or integration action as completed unless it actually occurred.
