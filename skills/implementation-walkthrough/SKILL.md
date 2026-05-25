---
name: implementation-walkthrough
description: Use when the user asks for a concise explanation of implemented code changes, a review-ready handoff, or a step-by-step walkthrough covering what changed, why, decisions, tradeoffs, validation, and notable context.
---

# Implementation Walkthrough

Use this skill after code changes when the user wants to review what happened
without re-reading the whole diff.

## Workflow

1. Inspect the actual changes before explaining them. Prefer `git diff`,
   changed file reads, test output, and command history over memory.
2. Explain the change in the order a reviewer should understand it, not
   necessarily the order the code was edited.
3. Keep the walkthrough concise and precise. Include enough code to orient the
   user, but do not paste large unchanged blocks.
4. Call out decisions, tradeoffs, assumptions, and anything that may affect
   review, testing, deployment, or future changes.
5. Clearly separate confirmed facts from inferences.

## Output Shape

Use this structure unless the user asks for a different format:

```md
**Summary**
Briefly state the outcome in 1-3 sentences.

**Walkthrough**
- Step through the important changes by behavior, feature area, or file.
- Include small code snippets only when they make the change easier to review.
- Link to relevant files and lines when available.

**Decisions And Tradeoffs**
- Explain meaningful implementation choices.
- Mention alternatives considered only when they affected the result.

**Validation**
- List tests, builds, linters, manual checks, or commands run.
- If validation was skipped or failed, say why and what remains unverified.

**Review Notes**
- Mention risks, assumptions, edge cases, migration concerns, or follow-up work.
```

## Style Rules

- Be direct and reviewer-oriented.
- Avoid broad tutorial explanations of the language, framework, or obvious code.
- Prefer concrete references: filenames, functions, commands, test names, and
  observable behavior.
- Keep code snippets short. Summarize unchanged surrounding code instead of
  reproducing it.
- Do not claim tests passed unless they were actually run in this session or
  reliable output is available.
- If there were no code changes, say so and explain what was inspected.
