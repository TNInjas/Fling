# Contributing

Thank you for considering a contribution.

## What is useful

- Reproducible bug reports from a named Antigravity CLI version and operating system.
- Compatibility reports with exact configuration paths and test results.
- Documentation improvements that make installation or workflow behaviour clearer.
- Focused workflow improvements supported by a concrete problem and rationale.

## Before opening an issue

1. Check whether the issue already exists.
2. Include the Antigravity CLI version, operating system, shell, and relevant plugin versions.
3. Describe the expected behaviour and the observed behaviour separately.
4. Include minimal reproduction steps and sanitized output. Never post credentials, API keys, tokens, private repository contents, or personal data.

## Pull request expectations

1. Keep changes scoped and explain the problem they solve.
2. Preserve the distinction between the workflow specification and capabilities actually verified in a CLI environment.
3. Do not claim EGM, CodeRabbit, asynchronous agents, or fresh-context review were used unless there is evidence.
4. Update documentation and `SOURCE-TRACEABILITY.md` when the source-to-package mapping changes.
5. Run the local test suite:

   ```bash
   bash -n install.sh uninstall.sh tests/test-install.sh
   bash tests/test-install.sh
   ```

6. Do not include real secrets, personal configuration, generated caches, or local `.agent/` task artifacts.

## Changing the workflow specification

The PDF is the Version 1.1 user-authored specification and is included as the reference source. A change to the operational skill or global rules that changes intended behaviour should be accompanied by:

- A clear explanation of the requested change.
- The corresponding source-specification update or an explicit note that the package is proposing a later revision.
- An updated traceability table.
- A version and changelog update.

Avoid silently changing the specification while continuing to label it Version 1.1.
