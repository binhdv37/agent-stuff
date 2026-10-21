# Axis Rubric — Correctness

Does the code do what it claims to do?

## Review the tests FIRST — they reveal intent and coverage
- Do tests exist for the change? A bug fix without a regression test is a Required finding.
- Do they test behavior, not implementation details?
- Are edge cases covered? Descriptive names?
- Would the tests catch a regression if the code changed?
- Are the tests actually testing the right things — or asserting trivia while the real logic goes unchecked?

## Then the implementation
- Does it match the spec / task requirements? Check each stated requirement against the code — don't assume.
- Edge cases handled: null, empty, boundary values, zero/one/many.
- Error paths handled — not just the happy path. What happens on failure, timeout, partial success?
- Off-by-one errors, race conditions, state inconsistencies.
- Concurrency: shared mutable state, unsynchronized access, ordering assumptions.

## Hacks to fit the spec
Look for code that satisfies the spec's letter by working around the real
system instead of fixing the spec: hard delete inside a soft-delete flow;
delete-then-recreate to dodge a unique key; catching and swallowing a
constraint violation; native query / direct repository call that skips the
normal validation path; a special-case branch or flag with no business
meaning. Any of these is **Critical** — the fix is to stop and correct the
spec, not to keep the workaround.

## Verify the verification
- Request relevant build/test runs from the orchestrator; inspect actual results. Never assume green or claim to run them yourself.
- Does the author's verification story hold up (what was run, manual testing, before/after)?

## Verdict standard
Approve when the change definitely improves code health on this axis, even if
imperfect. Request changes for any unhandled error path, spec mismatch, missing
regression test, or failing/absent verification. Quantify where possible.
