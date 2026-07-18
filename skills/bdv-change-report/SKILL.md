---
name: bdv-change-report
description: Produce a short, high-level report for requests such as "give me the change report," "summarize the changes," "what did you change," or "/change-report." Covers behavior differences, assumptions, known gaps, risk areas, and manual verification without a line-by-line walkthrough. Do not invoke automatically. Use this skill only when the user explicitly requests this workflow or names the skill.
disable-model-invocation: true
---

# Change Report

Your job here is to compress a code change into something a busy human can
review in under a minute, without hiding anything that matters. Optimize for
the reader's limited attention, not for making the change look complete.

## When this runs

Only when the user explicitly asks for it. Do not run this automatically
after finishing a coding task — wait to be asked, even if the change was
large. If you're not fully certain what changed by the time you're asked
(e.g. some time or turns have passed), run `git status` and `git diff` (and
`git diff --staged`) first to ground the report in the actual current diff
rather than relying on memory.

## Output format

Use these exact headings. Bullets, not paragraphs. No code snippets inside
the report — the diff already has the detail; this is for understanding.

### Summary
1–3 sentences, plain language: what changed and why. Avoid implementation
jargon and code identifiers where possible.

### Files touched
Group by purpose/module, not a flat list.
e.g. `Auth: login.ts, session.ts` · `Tests: login.test.ts`

### Behavior diff
For each meaningful change: `Before: X → After: Y`, focused on observable
behavior, not code structure. If this was a pure refactor with no behavior
change, say that explicitly — it's a useful signal on its own.

### Assumptions made
Anything inferred because the request was ambiguous or underspecified, or any
judgment call made along the way. Name the assumption and why you chose it.
If none, say so.

### Known gaps / not done
Anything skipped, deferred, stubbed, partially implemented, or left as a TODO
in code. Anything explicitly out of scope. Only say "nothing" if that's true.

### Risk flags
Tag each: 🔴 must-check / 🟡 worth a look / ⚪ minor.

Always flag if touched: auth/permissions, payments/billing, data
deletion/migration, concurrency/race conditions, external API calls, error
handling paths, or anything you're not fully confident is correct.

If you did not actually trace an edge case (empty input, null, concurrent
calls, network failure, retries), say so directly rather than staying silent
about it.

### What to verify manually
The 2–5 highest-value things to check first, ordered by importance. Think
like a reviewer with two minutes: "start here." This is the most important
section — it's what directs the human's limited attention to what matters.

## Hard rules

- Never write "robust," "production-ready," "clean," or "handles all edge
  cases" without stating exactly what was checked to justify it.
- If you built on or modified logic you don't fully understand — inherited
  code, an unfamiliar pattern, unclear intent — say so plainly instead of
  presenting it with confidence you don't have.
- Prefer "I'm not certain X handles Y" over silence or false confidence.
- The report must reflect what you actually did and verified, not what a
  typical/ideal solution to this task would look like.
- If truly nothing risky or noteworthy happened (e.g. a one-line typo fix),
  keep the report to 2–3 lines total — don't pad it to look thorough.
