# Axis Rubric — Security

Does the change introduce vulnerabilities?

## Core checks
- User input validated and sanitized at system boundaries BEFORE use in logic or rendering.
- Data from external sources (APIs, logs, user content, config files) treated as untrusted.
- Secrets kept out of code, logs, and version control — flag any hardcoded token, password, key, or connection string.
- Authentication/authorization checked where needed — especially new endpoints, changed access paths, and object-level access (can user A reach user B's data?).
- SQL/queries parameterized — no string concatenation into queries or commands (injection: SQL, command, path traversal, template).
- Outputs encoded to prevent XSS; unsafe HTML rendering flagged.
- Unsafe deserialization, SSRF on user-controlled URLs, open redirects.
- Sensitive data in logs, error messages, or API responses (overexposure).

## Dependencies (supply chain)
- New/updated dependencies from trusted sources, no known vulnerabilities (audit tooling where available).
- Watch for typosquatting-style names and suspicious transitive additions in the lockfile diff.

## Verdict standard
An exploitable vulnerability, secret in code, or missing auth check is
**Critical** — it blocks merge regardless of everything else. Hardening gaps
with no direct exploit path are Required or Optional per realistic risk. Don't
soften real issues; state the attack scenario concretely.
