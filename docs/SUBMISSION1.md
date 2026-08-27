# Build 1 Lakebase submission

This is the required finalization procedure for **Build 1 — Lakebase**. It is
independent from the Build 2 app package.

## Required artifact

Put everything that should be scored for the Lakebase build in the top-level
`submission1/` folder. The Build 1 validator scores that folder only; files in
`submission2/` or elsewhere do not count.

`submission1/` must contain:

1. The relevant finished Lakebase code and configuration.
2. Every Build 1 proof export, using the **exact filenames from the Build 1
   brief**.
3. `git_history.txt`, containing the final `git log` output so the required
   branch-and-merge steps can be verified.

Do not guess the export filenames. Copy them verbatim from the Build 1 brief.

## Packaging constraints

- Compress the `submission1/` folder itself so the upload is
  `submission1.zip` with `submission1/` as its top-level directory.
- Keep the zip comfortably below approximately 40 MB.
- Do not include datasets, dependencies, caches, or large binaries.
- Keep each export focused. The validator reads about the first 400 KB of each
  file.
- Trim committed exports to the records that prove the build, retaining the
  budget block, guardrail block, and returned rows.

## Finalization checklist

- [ ] Lakebase implementation and validation are complete.
- [ ] The Build 1 brief has been checked for exact export filenames.
- [ ] Only Build 1 Lakebase code, configuration, and evidence are included.
- [ ] All proof exports exist under `submission1/` with exact names.
- [ ] Required budget, guardrail, and returned-row evidence appears within the
      first 400 KB of each relevant export.
- [ ] `submission1/git_history.txt` reflects the final repository history.
- [ ] No datasets, dependencies, caches, secrets, or unnecessary binaries are
      included.
- [ ] `submission1.zip` contains `submission1/` as its top-level directory.
- [ ] The archive member list has been inspected.
- [ ] The final zip is below 40 MB.
