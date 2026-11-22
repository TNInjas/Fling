# Ponytail Upstream Integration

## Upstream Metadata
- **Repository:** https://github.com/DietrichGebert/ponytail
- **Vendored Version / Tag:** `v5.3.3-1-g96608e0` (Release `v5.3.3`)
- **Git Commit Hash:** `96608e078b2d5ea607c5c3b8b5a54d1c1fba6846`
- **Author:** Dietrich Gebert (`dietrich.gebert@gmail.com`)
- **License:** MIT License (retained in `upstream/LICENSE`)

## Methodology Summary
Ponytail is an implementation methodology designed to favor minimal effective changes and reuse over creating new abstractions or unnecessary code:
1. Does the proposed capability need to exist?
2. Does the required functionality already exist in the codebase?
3. Can the standard library solve it?
4. Is there an existing native platform feature?
5. Is an appropriate dependency already installed?
6. Can the problem be solved with a smaller implementation?
7. Only then should new functionality be implemented.

## Integration in Fling (UEW)
- **Vendored Source:** Stored unmodified under `subsystems/ponytail/upstream/`.
- **Project-Level Always-On Rules:** Active in `.agents/rules/ponytail.md` for Antigravity directory and workspace awareness.
- **CLI Plugin & Skills:** Active in Antigravity via `agy plugin install` (`ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`).
- **Modifications:** None. Upstream source and license are preserved without modification.
