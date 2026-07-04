---
name: bdv-smart-commit
description: Stage all changes, generate a Conventional Commit message from the diff, and commit. Use when the user says "commit", "commit this", "commit my changes", "commit for me", or wants a clean git commit without manual staging or message writing.
---

# Smart Commit

Automates the git commit workflow: stage, generate message, commit.

## Workflow

1. **Check for changes**
   - Run `git status --short` to detect staged and unstaged changes.
   - If nothing to commit, report "Nothing to commit" and stop.

2. **Stage all changes**
   - Run `git add -A` to stage everything.
   - This is intentional — the user has explicitly asked for smart-commit.

3. **Analyze the diff**
   - Run `git diff --cached` to review staged changes.
   - Identify:
     - Primary change type (feat, fix, refactor, chore, docs, test, style, perf, ci, build)
     - Scope (which module, file, or area was affected)
     - What changed and why (infer from code context)

4. **Generate commit message**
   - Use **Conventional Commits** format:

     ```
     <type>[optional scope]: <short summary>

     [optional body]
     ```

   - Rules:
     - `type` must be one of: feat, fix, refactor, chore, docs, test, style, perf, ci, build
     - `scope` is optional — use only when the change is scoped to a clear module/area
     - `summary` is imperative, lowercase, no period, max 72 chars
     - `body` is optional — add only when the change is non-obvious or multi-part
     - If the diff mixes types (e.g. a fix + a refactor), pick the dominant type and mention the other in the body

5. **Confirm before committing**
   - Show the user:
     - The proposed commit message
     - Summary of files changed (count + names)
     - Ask for approval before running `git commit`

6. **Commit**
   - Run `git commit -m "<message>"` with the approved message.
   - Report the resulting commit hash and branch.

## Do NOT

- Push automatically — the user did not ask for push.
- Amend previous commits — unless the user explicitly says "amend".
- Commit secrets, credentials, or .env files — warn the user if detected.
- Force commit on a dirty worktree with merge conflicts.

## Edge Cases

- **Nothing staged after `git add -A`**: This means the working tree is clean. Report and stop.
- **Merge in progress**: Detect `MERGE_HEAD` and include the merge context in the message body.
- **Detached HEAD**: Warn the user before committing.
- **Secrets detected**: If `git diff --cached` contains patterns like API keys, passwords, tokens, or .env content, STOP and warn the user. Do not commit.
