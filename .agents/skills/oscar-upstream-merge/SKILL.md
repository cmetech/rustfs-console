---
name: oscar-upstream-merge
description: Assess and rehearse upstream RustFS Console updates into the OSCAR fork, preserving branding and appearance behavior while keeping main upstream-only.
---

# OSCAR Console upstream merge

Read `AGENTS.md` and `docs/upstream-customizations/oscar.json` first. The customization branch is `oscar`; `main` contains upstream history only. `origin` is the OSCAR fork, `upstream` is `https://github.com/rustfs/console.git`. Verify remotes before fetching or pushing.

## Assess and rehearse

1. Inspect status. Preserve the user's edits; never stash, clean, or reset them. Commit reviewed merge-control changes before rehearsal. Uncommitted source changes are reported and **excluded** from the trial, so they must be reconciled before applying a real merge.
2. Fetch upstream tags and branches. Resolve the requested release/ref to its full commit SHA and verify its provenance in fetched upstream history. Use that immutable SHA for the entire run, not a moving branch name.
3. From `oscar`, run `node scripts/oscar-upstream.js <sha>` for the JSON review inventory. Baseline and `main` must be ancestors of the target; investigate a rejected range rather than rewriting history to pass it.
4. Run `node scripts/oscar-upstream.js <sha> --trial /absolute/new/path/outside/repo`. This merges only in a detached worktree, without committing, updating branches, advancing the baseline, or pushing. Exit 2 means conflicts remain; exit 1 means preflight or another error. Retain the trial for inspection. Remove it with `git worktree remove` only after its review work is saved; never force-remove unknown work.
5. Review every changed file and every ledger entry, including entries without textual conflicts. Theme overlays can silently hide an upstream security or behavior fix. Record each overlap as take-upstream, union-adapt, remove-equivalent-customization, retain-downstream-behavior, or blocked-unclear, with evidence and tests. Never resolve shared source wholesale with ours/theirs or omit upstream commits.
6. In the trial, run the AGENTS quality gates, default and OSCAR production builds, branding/appearance tests, and the ledger's runtime checks. Record target/head SHAs, dispositions, command results, untested checks, and residual risks in the merge review. A clean Git merge does not prove compatibility with the RustFS engine.

## Apply only within the authorized scope

If the request only asked for assessment/rehearsal, stop with the concrete report. If it already authorized the real merge, proceed when its checks pass; otherwise obtain approval for that result. Verify the real `oscar` HEAD still equals the trial's `head`, reconcile any original dirty work, and reproduce the reviewed merge/resolutions on a clean `oscar` branch. Preserve full upstream ancestry.

After real-merge checks pass, update the ledger baseline to the pinned target in the same reviewed change. Synchronize `main` only by fast-forwarding to verified upstream history, never by merging `oscar` into it. Push or publish only within the user's authorization; never force-push `main`. Leave the working checkout on `oscar`. A merge does not authorize deploying services or publishing bundled branding assets.
