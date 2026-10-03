# Smart Commit

Help the user commit session work quickly. Run only when the user explicitly
invokes `bdv-smart-commit`; finishing a coding task is not invocation.

## 1. Read changes and propose

Use read-only Git commands and ordinary file-reading tools to inspect the branch,
staged/unstaged changes and untracked files. Typical commands are `git status
--short`, `git diff` and `git diff --cached`; read untracked files separately.
Read repository commit conventions if present. Do not stage or commit yet.

Use what you know from this session and the user's requested scope to identify
the work to commit. Warn about changes you did not make, changes already present
before your work, unexpected edits and mixed user/agent changes in the same file.
If attribution is unclear, say so; Git alone does not establish who made a change.
Do not invent a baseline or treat examples as facts about the repository.

Propose:

- Branch, exact selected files and a short content summary.
- Warnings and excluded changes, with brief reasons.
- The full commit message and exact staging/commit commands in execution order.
- One question asking whether to approve the plan or change scope/message.

Stage individual files with safely quoted literal paths, for example:

```text
git --literal-pathspecs add -- src/auth/login.ts tests/auth/login.test.ts
git commit -m 'fix(auth): handle login timeout'
```

Never use `git add -A`, `git add .`, directory/glob staging or `git commit -a`.
An ordinary commit includes the whole index: disclose existing staging and do not
silently include excluded work. For separate selected files whose whole content
is approved, `git --literal-pathspecs commit --only ... -- <exact-paths>` may
preserve unrelated staging. Explain that it commits the working-tree file, not
only staged hunks. Do not use it to extract agent hunks from a mixed file or for
staged-only requests. If scope cannot be preserved, ask the user to separate the
changes or approve a different scope; do not unstage, stash or reset their work.

For staged-only requests, omit `git add` and commit the approved index. If that
index also includes excluded files, stop and explain the scope conflict.
Warn before including mixed hunks or replacing partial staging with a full file.
If there are no changes, report that and stop. Stop for unresolved conflicts or
an in-progress Git operation. If you notice suspected credentials, warn with
values redacted and exclude them pending clarification.

Keep this a read → propose → approve → execute workflow. Do not create snapshots,
hash manifests, helper scripts or temporary directories, or run a mandatory
second review/state check before execution.

## 2. Follow the user's reply

If approved, execute the exact proposed commands with the approved message.
Do not add a pre-execution recheck. If the user changes scope/message, refine
the proposal and request approval for the revised plan. If they decline, stop
without Git mutations. Clarify ambiguous approval rather than guessing.

Respect harness permissions and keep hooks enabled. On command failure, report
the error and actual outcome, then stop; do not bypass hooks, change configuration
or retry with broader commands. If staging succeeded but commit failed, tell the
user that the files remain staged; do not undo it automatically.

After success, report the commit hash/message and remaining changes. A brief
post-commit `git status --short` is enough; no content fingerprint audit is needed.

## 3. Offer push separately

After committing, inspect the actual remote/push URL, upstream and destination
branch. Use `git ls-remote` for current destination refs and explain which local
commits would be published, including earlier unpushed commits. Do not assume
`origin`, `main` or a current tracking ref. If the destination is ambiguous,
remote access fails or history cannot be assessed, explain and ask what to use.
Fetching missing history requires its own proposed command and approval.

Show the destination and exact single-branch push command, then ask whether to
push. Include `--set-upstream` only when needed and explain it. Wait for separate
approval, then run the approved command. Do not add force, mirror, tags, deletion,
automatic pull/rebase or PR/MR creation. If declined, keep the commit local.
On failure, report it and stop.

After a successful push, provide a PR/MR creation link when the provider and
base/head are known: prefer GitLab's returned MR link; use GitHub's compare/PR
page with the correct branches, accounting for forks. Encode branch/query values.
If the base or URL format is unclear, ask or give the confirmed repository page;
do not fabricate a link, create a request or open a browser automatically.

## Commit messages

Follow the repository convention; otherwise use Conventional Commits:
`<type>[(scope)][!]: <description>`. Choose a suitable type such as `feat`, `fix`,
`refactor`, `docs`, `test` or `chore`; use an optional code-area scope. Prefer an
English imperative subject, no final period, around 72 characters or less.
Use known tickets in a footer such as `Refs: APP-123`, unless the repository uses
ticket scopes/subjects. Do not invent tickets or closing intent. Mark breaking
changes only when the change actually breaks a public contract. Recommend separate
commits for unrelated work and obtain approval for each plan.
