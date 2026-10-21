# Axis Rubric — Readability & Simplicity

Can another engineer (or agent) understand this code without the author explaining it?

## Core checks
- Names descriptive and consistent with project conventions (no `temp`, `data`, `result` without context).
- Control flow straightforward — no nested ternaries, deep callbacks, clever tricks that should be simplified.
- Code organized logically: related code grouped, clear module boundaries.
- Could this be done in fewer lines? 1000 lines where 100 suffice is a failure.
- Are abstractions earning their complexity? Don't generalize until the third use case.
- Comments tell WHY (intent, constraints, business rules), not WHAT. Flag comments restating trivial code, and non-obvious logic missing a why.
- Is a new conditional bolted onto an unrelated flow? That's a design smell, not a nit — the logic belongs in its own helper, state, or policy.
- Repeated conditionals on the same shape signal a missing model or dispatcher. A "temporary" branch is usually permanent debt.

## Dead code hygiene
- No-op variables (`_unused`), backwards-compat shims, `// removed` comments, now-unreachable code after the change.
- List each item explicitly in DEAD CODE. Do NOT delete — the orchestrator asks the user.

## Change & file sizing
- ~100 changed lines: good. ~300: acceptable if one logical change. ~1000: too large — recommend splitting (stack / by file group / horizontal / vertical).
- Watch file size, not just diff size: a change that grows an already-large file (~1000+ total lines) without decomposing is a finding — decompose first, then add.
- Refactoring mixed with feature work is two changes — flag it.

## Structural remedies — propose the move, not just the problem
- Collapse duplicate branches into a single clearer flow.
- Extract a helper, or split a large file into focused modules.
- Delete a pass-through wrapper that adds indirection without clarifying the API.

## Verdict standard
Approve when the change definitely improves code health on this axis, even if
imperfect — don't block on "not how I'd write it." Style preferences are Nit.
Structural smells (bolted-on conditionals, unearned abstraction, un-decomposed
growth) are Required, with the remedy named.
