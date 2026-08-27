# Agent memory

This repository has three distinct scored deliverables:

- **Build 1 — Lakebase** → `submission1/` and `submission1.zip`
- **Build 2 — app** → `submission2/` and `submission2.zip`
- **Build 3 — Unity AI Gateway** → `submission3/` and `submission3.zip`

Before finishing a build, read and follow its required handoff checklist:

- Lakebase: [`docs/SUBMISSION1.md`](docs/SUBMISSION1.md)
- App: [`docs/SUBMISSION2.md`](docs/SUBMISSION2.md)
- Unity AI Gateway: [`docs/SUBMISSION3.md`](docs/SUBMISSION3.md)

Never place one build's evidence in another build's folder.

Important persistent constraints:

- The Build 1 validator scores only top-level `submission1/`; the Build 2
  validator scores only top-level `submission2/`; the Build 3 validator scores
  only top-level `submission3/`.
- Build the app submission from `app/` after all app work is complete.
- Use the exact export filenames from the applicable build brief; never invent
  or rename them. If the brief is unavailable, stop packaging and obtain it
  first.
- Include `git_history.txt`, generated from the final `git log`, inside each
  submission folder so branch-and-merge history can be verified.
- Archive the applicable folder itself and keep each zip below approximately
  40 MB.
- Never include datasets, `node_modules`, caches, or other large binaries.
- Keep each proof export focused and below the validator's approximately
  400 KB useful-read window. Preserve the budget block, guardrail block, and
  returned rows needed to prove the build.
- Before handoff, inspect both the archive size and the archive member list.
