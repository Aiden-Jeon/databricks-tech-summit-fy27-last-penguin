# Agent memory

This repository has three distinct scored deliverables:

- **Build 1 — Lakebase** → `submission/submission1/` and `submission/submission1.zip`
- **Build 2 — app** → `submission/submission2/` and `submission/submission2.zip`
- **Build 3 — Unity AI Gateway** → `submission/submission3/` and `submission/submission3.zip`

Before finishing a build, read and follow its required handoff checklist:

- Lakebase: [`submission/docs/SUBMISSION1.md`](submission/docs/SUBMISSION1.md)
- App: [`submission/docs/SUBMISSION2.md`](submission/docs/SUBMISSION2.md)
- Unity AI Gateway: [`submission/docs/SUBMISSION3.md`](submission/docs/SUBMISSION3.md)

Never place one build's evidence in another build's folder.

Important persistent constraints:

- **All final submission folders, archives, and handoff checklists must be kept
  under the project-root `submission/` directory.** Never hand off a final
  artifact from `/tmp`, `/private/tmp`, another worktree, or any directory
  outside this repository. Before reporting completion, verify the exact path
  under `submission/` that the user will upload.
- Keep the three builds separate at `submission/submission1/`,
  `submission/submission2/`, and `submission/submission3/`. Each zip must still
  contain its matching `submissionN/` folder as the archive's top-level member.
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
