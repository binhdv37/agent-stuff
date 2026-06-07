---
name: verify-implementation
description: Force verification of a just-implemented feature by running or writing tests. Use after an agent claims a feature is done and you want proof, not an explanation.
---

# Verify Implementation

## When to use

Right after a feature has been implemented and the agent reports it is done.
Use when you want concrete evidence the feature works — passing tests, not
narrative — and a clear accounting of any remaining risk.

## Prompt

You implemented this feature. Now prove it works.

  Do not just explain. Please:
  1. Identify the expected behavior from the requirements and code.
  2. Add or update automated tests where appropriate.
  3. Run the relevant test commands.
  4. If tests fail, debug and fix the issue.
  5. Report exactly which commands passed, which behavior is covered, and any remaining risk.

## Example

Context: an agent has just added a `retryWithBackoff(fn, opts)` helper to
`src/utils/retry.ts` and says it is done.

Expected response shape:

1. Expected behavior: retries up to `opts.maxAttempts` times with exponential
   backoff starting at `opts.initialDelayMs`, and throws the last error if
   all attempts fail.
2. Adds `src/utils/retry.test.ts` covering: success on first try, success on
   retry, exhaustion of attempts, jitter optionality, abort signal handling.
3. Runs `npm test -- src/utils/retry.test.ts` — passes.
4. N/A (no failures).
5. Coverage: 4/4 unit tests pass. Not covered: interaction with real
   network or timer-mocked system clock beyond `jest.useFakeTimers()`.
