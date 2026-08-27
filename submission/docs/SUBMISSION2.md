# Build 2 app submission

This is the required finalization procedure for the **Build 2 app**. Run it
only after implementation and validation are complete.

## Required artifact

The upload artifact is `submission/submission2.zip`, containing the top-level
`submission2/` folder. The validator ignores evidence stored elsewhere in the
repository.

`submission/submission2/` must contain:

1. The finished, relevant app source from `app/`.
2. Every Build 2 proof export, using the **exact filenames specified by the
   build brief**.
3. `git_history.txt`, containing the final `git log` output and showing the
   required branch-and-merge work.

The exact proof-export names are deliberately not guessed in this document.
Copy them verbatim from the Build 2 brief when it is available, then record
them in the final verification notes.

## Packaging constraints

- Do not include datasets or large binaries.
- Exclude dependency and generated-cache directories such as `node_modules/`,
  `.git/`, test caches, and local environment files.
- Include generated build output only when the build brief explicitly requires
  it.
- Keep the final zip comfortably below 40 MB; an upload over approximately
  40 MB is refused.
- The validator reads only about the first 400 KB of a file. Trim committed
  exports to the records that demonstrate the build: the budget block, the
  guardrail block, and the returned rows.
- Keep each export focused; do not combine unrelated logs or full datasets.

## Finalization checklist

- [ ] App implementation and tests are complete.
- [ ] The Build 2 brief has been checked for exact export filenames.
- [ ] `submission/submission2/` was freshly assembled from the final `app/` source rather
      than trusted as an old copy.
- [ ] All required proof exports exist under `submission/submission2/` with exact names.
- [ ] Each export contains the relevant budget, guardrail, and returned-row
      evidence within its first 400 KB.
- [ ] `submission/submission2/git_history.txt` reflects the final repository history.
- [ ] No dataset, `node_modules`, cache, secret, or unnecessary large binary is
      present.
- [ ] `submission/submission2.zip` contains `submission2/` as its top-level directory.
- [ ] The zip member list has been inspected.
- [ ] The final zip is below 40 MB.

## Current repository warning

Rebuild `submission/submission2/` and `submission/submission2.zip` from the
finished app at finalization time according to this checklist.
