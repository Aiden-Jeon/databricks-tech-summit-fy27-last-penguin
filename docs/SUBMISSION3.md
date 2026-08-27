# Build 3 Unity AI Gateway submission

This is the required finalization procedure for **Build 3 — Unity AI
Gateway**. It is independent from the Lakebase and app packages.

## Required artifact

Put everything that should be scored for the Unity AI Gateway build in the
top-level `submission3/` folder. The Build 3 validator scores that folder only;
files in other submission folders or elsewhere do not count.

`submission3/` must contain:

1. The relevant finished Unity AI Gateway code and configuration.
2. Every Build 3 proof export, using the **exact filenames from the Build 3
   brief**.
3. `git_history.txt`, containing the final `git log` output so the required
   branch-and-merge steps can be verified.

Do not guess the export filenames. Copy them verbatim from the Build 3 brief.

## Packaging constraints

- Compress the `submission3/` folder itself so the upload is
  `submission3.zip` with `submission3/` as its top-level directory.
- Keep the zip comfortably below approximately 40 MB.
- Do not include datasets, dependencies, caches, or large binaries.
- Keep each export focused. The validator reads about the first 400 KB of each
  file.
- Trim committed exports to the records that prove the build, retaining the
  budget block, guardrail block, and returned rows.

## Finalization checklist

- [ ] Unity AI Gateway implementation and validation are complete.
- [ ] The Build 3 brief has been checked for exact export filenames.
- [ ] Only Build 3 Unity AI Gateway code, configuration, and evidence are
      included.
- [ ] All proof exports exist under `submission3/` with exact names.
- [ ] Required budget, guardrail, and returned-row evidence appears within the
      first 400 KB of each relevant export.
- [ ] `submission3/git_history.txt` reflects the final repository history.
- [ ] No datasets, dependencies, caches, secrets, or unnecessary binaries are
      included.
- [ ] `submission3.zip` contains `submission3/` as its top-level directory.
- [ ] The archive member list has been inspected.
- [ ] The final zip is below 40 MB.
