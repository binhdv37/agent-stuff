# Axis Rubric — Performance

Does the change introduce performance problems?

## Core checks
- N+1 query patterns (query inside a loop; lazy-load fan-out; per-item RPC).
- Unbounded loops or unconstrained data fetching — missing LIMIT, loading a whole table/collection into memory.
- Missing pagination on list endpoints.
- Synchronous operations that should be async (blocking I/O on hot paths, sequential awaits that could batch).
- Large objects created in hot paths; unnecessary copies; allocation in tight loops.
- Unnecessary re-renders in UI components (unstable references, missing memoization where measurably needed, subscriptions too broad).
- Caching: obvious repeated computation/fetch of identical data; but flag speculative caching complexity too (unearned optimization is a readability cost — hand it off, don't chase).
- New indexes/queries: does the query shape match existing indexes? NOTE: never justify schema/index decisions from a local database's row counts — if the verdict depends on production data distribution, say so and mark it for the user to confirm.

## Quantify
Estimate impact where possible: "this N+1 adds ~50ms per item on a 100-item
list" beats "this could be slow." State the assumption behind the number.

## Verdict standard
Approve when the change definitely improves code health on this axis, even if
imperfect. Request changes for unbounded operations, N+1 on known-hot paths,
or missing pagination on list endpoints. Micro-optimizations are Nit/Optional
unless on a measured hot path.
