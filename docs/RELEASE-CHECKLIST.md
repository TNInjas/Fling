# Release checklist

Use this checklist when publishing a new version.

- [ ] Confirm the workflow specification version and whether the PDF source changed.
- [ ] Update `VERSION` and `CHANGELOG.md`.
- [ ] Update `SOURCE-TRACEABILITY.md` if any source section moved or changed.
- [ ] Review compatibility claims against actual tested CLI/OS/plugin versions.
- [ ] Run `bash -n install.sh uninstall.sh tests/test-install.sh`.
- [ ] Run `bash tests/test-install.sh`.
- [ ] Verify installer dry-run and overwrite refusal.
- [ ] Verify uninstaller dry-run, safe removal, and modified-file protection.
- [ ] Confirm the bundled PDF is the intended source version.
- [ ] Inspect archive contents; do not include local configuration, secrets, or test artifacts.
- [ ] Create a Git tag matching the package version (for example, `v1.1.0`).
- [ ] Attach the release ZIP and publish concise release notes.
