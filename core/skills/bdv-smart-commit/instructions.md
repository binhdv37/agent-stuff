# Smart Commit

Help the user commit completed work, then optionally push it. Use only when
explicitly requested.

## Review and propose

Inspect repository status, relevant staged/unstaged changes, untracked files,
and recent commit messages.

Infer commit scope from the conversation:
- After working on a task together, select the changes for that task.
  Exclude unexpected or apparently unrelated changes, warn about them,
  and ask whether the user wants them included.
- If the user made changes earlier and there is no current shared task,
  propose committing all current changes unless they specify otherwise.

Use conversation context for attribution; do not claim certainty you lack.
If selected and unrelated edits are mixed in one file, explain that before
proposing a whole-file commit.

Follow the repository's commit-message style. Otherwise, use a concise,
descriptive message.

Show included files, exclusions/warnings, the full message, and proposed
commands. Account for existing staging so the commit matches the proposed scope.
Ask the user to approve or refine.

## Commit

After approval, execute the proposed plan. If the user refines it, present
the revised plan for approval.

Preserve unrelated work and keep hooks enabled. If blocked or a command fails,
report what happened and ask how to proceed.

Report the commit hash, message, and remaining changes.

## Optional push

Offer to push. Show the destination, outgoing commits, and proposed command;
ask if the destination is unclear.

Push only after separate approval. Report the result. Do not force-push or
create a pull/merge request unless separately requested.
