---
name: bdv-explain-code
description: Explain existing (already-committed, no-diff) code for requests such as "explain this code," "walk me through this module/feature/API," "review this for me," "/explain-code," or a question about a file, function, or snippet. Produces a short, high-level report covering structure, non-obvious behavior, edge cases, risk flags, open questions, and where to look next. Do not invoke automatically. Use this skill only when the user explicitly requests this workflow or names the skill.
disable-model-invocation: true
---

# Explain Code

Your job is to make unfamiliar, already-written code reviewable in under a
minute, without hiding anything that matters. Optimize for the reader's
limited attention, not for making the code look clean or complete. This is
the no-diff counterpart to the change-report skill — use this one when there
is no recent edit to compare against, just existing code to understand.

## When this runs

Only when the user explicitly asks — for a feature, module, API, function, or
pasted block. Do not run this just because code appeared in the conversation
or context; wait to be asked.

If the target isn't clear (which file/module/function), ask before
proceeding — don't guess.

## Before writing the report

Actually read the relevant code: open the file(s), follow key callers/usages,
check related config or types. Don't answer from a skim, from memory of
similar code, or from what this kind of code "usually" looks like — ground
everything in what's actually there. If you only have time/access to read
part of it, say exactly which part in the report.

## Output format

Use these exact headings. Bullets, not paragraphs. Only include short code
references (function/variable names) when needed for precision — no full
snippets or line-by-line walkthroughs.

### Summary
1–3 sentences: what this does and why it likely exists, in plain language.

### Structure
The key files/functions/components involved and each one's role. Identify
the entry point and how control flows between the pieces.

### How it works
3–6 bullets on the core logic — decisions, branches, state transitions, data
flow. Skip syntax-level detail; focus on what a reviewer needs to reason
about correctness.

### Non-obvious behavior
Anything a first read would likely miss: side effects, ordering requirements,
shared/global state, magic values or flags that change behavior, unusual
error handling, implicit assumptions baked into the code.

### Edge cases
What's handled vs. not, as far as you can tell: empty/null input, concurrency
or race conditions, retries, failures of external calls, size/scale limits.
State clearly which of these you actually traced in the code vs. which you're
inferring or unsure about — don't blur the two.

### Risk flags
Tag each: 🔴 must-check / 🟡 worth a look / ⚪ minor.

Flag: auth/permissions, payments/billing, data mutation or deletion,
concurrency, external dependencies/network calls, and anything that looks
fragile, tightly coupled, undocumented, or inconsistent with the rest of the
codebase.

### Open questions
Things you genuinely cannot determine from the code alone — unclear intent,
apparent contradictions, or behavior that depends on external context/config
you don't have visibility into. If none, say so.

### Where to look next
2–4 concrete pointers if someone wants to go deeper — related tests, callers,
adjacent modules, or docs worth reading.

## Hard rules

- Never claim to understand something you only skimmed. If you read some
  parts and not others, say exactly which.
- Never reconstruct "plausible" behavior instead of verified behavior — if
  you didn't confirm it by reading the code, label it as inferred, not fact.
- Prefer surfacing genuine confusion or contradictions over smoothing them
  into a tidy-sounding explanation.
- If the code is small/simple enough that most sections would be empty, say
  so and keep the report to a few lines — don't pad it out.
