# Smart Commit

Run only when the user explicitly invokes `bdv-smart-commit`.

## 1. Read and propose

Read branch, staged/unstaged diffs, untracked files and repository commit conventions
using ordinary read-only tools (`git status --short`, `git diff`, `git diff --cached`).
Use session knowledge to identify scope. Warn about pre-existing, unrelated,
unexpected or mixed user/agent edits; disclose uncertain attribution.

Show branch, exact selected files, brief summary, warnings/exclusions, full commit
message and exact commands in order. Ask the user to approve or revise.

Stage only individual, safely quoted literal paths:

```text
git --literal-pathspecs add -- src/auth/login.ts tests/auth/login.test.ts
git commit -m 'fix(auth): handle login timeout'
```

Never use `git add -A`, `git add .`, directories/globs or `git commit -a`.
An ordinary commit includes the entire index: disclose existing staging and
exclude unapproved work. For approved whole files, `git --literal-pathspecs commit
--only ... -- <paths>` can preserve unrelated staging, but commits working-tree
contents, not staged hunks. Never use it for mixed-hunk isolation or staged-only
requests. For staged-only requests, omit `add`; stop if the index includes excluded
work. Warn before including mixed edits or replacing partial staging with whole files.
If scope cannot be preserved, ask the user to separate changes or revise scope;
do not unstage, stash or reset their work.

Stop if nothing changed, conflicts remain or a Git operation is in progress.
Warn about suspected credentials with values redacted; exclude pending clarification.
Do not create snapshots, manifests, helpers or temporary directories.

## 2. Execute after approval

Approval: run the exact proposed commands/message directly, without a pre-execution
recheck. Revised scope/message: propose again and await approval. Decline: stop
without mutations. Clarify ambiguous approval.

Respect harness permissions and keep hooks enabled. On failure, report the actual
outcome and stop; no hook bypass, configuration changes or broader retries.
If commit fails after staging, report that files remain staged; do not undo.
On success, report hash/message and remaining changes (`git status --short`).

## 3. Offer push separately

Inspect actual remote/push URL, upstream, destination and current remote refs
(`git ls-remote`). Identify all outgoing commits, including earlier unpushed work.
Do not assume remote/branch or rely on stale tracking refs. If destination or
history is unclear, or remote access fails, ask; fetching needs proposed approval.

Show destination and exact single-branch push command; ask and await separate
approval. Prefer `git push <remote> <branch>` when it resolves to the intended
destination; use `<source>:<destination>` when needed. Include `--set-upstream`
only when needed and explain it. Execute as approved; stop on decline/failure.
No force, mirror, tags, deletion, automatic pull/rebase or PR/MR creation.

After push, provide a PR/MR creation link if provider and base/head are known:
prefer GitLab's returned link or GitHub's compare page with correct branches/forks
and encoded values. Otherwise give the confirmed repository page or ask.
Do not fabricate links, create requests or open a browser automatically.

## Commit message

Follow repo conventions; otherwise use `<type>[(scope)][!]: <description>`
(Conventional Commits). Use a code-area scope, English imperative subject without
a final period, preferably ≤72 characters. Put known tickets in `Refs: APP-123`
unless repo conventions differ; do not invent tickets or closing intent.
Mark actual public-contract breaks. Propose separate commits for unrelated work.
