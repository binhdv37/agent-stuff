---
name: bdv-smart-commit
description: With approval before staging and committing, stage all changes, generate a Conventional Commit message from the diff, and commit. Use when the user says "commit", "commit this", "commit my changes", "commit for me", or wants a clean git commit without manual staging or message writing.
---

# Smart Commit

Guides the git commit workflow: approve staging, stage, generate message, approve commit, commit.

## Workflow

1. **Check for changes**
   - Run `git status --short` to detect staged and unstaged changes.
   - If nothing to commit, report "Nothing to commit" and stop.

2. **Approve staging**
   - Show the files from `git status --short`, including their status (staged, modified, deleted, or untracked).
   - Use the current conversation history to identify files changed by the agent. Attribution is file-level: a file changed by both the agent and the user is agent-related.
   - If the agent changed files in this conversation and other changed files are not agent-related:
     - List agent-related and unrelated files separately.
     - Tell the user that unrelated changes were detected and ask whether to include them.
     - If the user approves, propose `git add -A` and ask for explicit approval to run it.
     - If the user declines, propose `git add -- <agent-related paths>` and ask for explicit approval to run it.
   - If every changed file is agent-related, propose `git add -- <agent-related paths>` and ask for explicit approval to run it.
   - If this is a new conversation or the agent made no code changes, propose `git add -A` and ask for explicit approval to run it.
   - If staging is declined, make no changes and stop.

3. **Stage all changes**
   - Run only the staging command approved by the user.

4. **Analyze the diff**
   - Run `git diff --cached` to review staged changes.
   - Identify:
     - Primary change type (feat, fix, refactor, chore, docs, test, style, perf, ci, build)
     - Scope (which module, file, or area was affected)
     - What changed and why (infer from code context)

5. **Generate commit message**
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

6. **Confirm before committing**
   - Show the user:
     - The proposed commit message
     - Summary of files changed (count + names)
      - Ask for explicit approval before running `git commit`
   - If declined, leave the approved changes staged and stop.
   - If the staged changes have changed since they were reviewed, review the current staged diff and ask for approval again.

7. **Commit**
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
