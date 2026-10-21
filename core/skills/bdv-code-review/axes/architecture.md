# Axis Rubric — Architecture

Does the change fit the system's design?

## Core checks
- Follows existing patterns, or introduces a new one? If new — is it justified, and was it approved?
- Clean module boundaries maintained; dependencies flow in the right direction (no cycles).
- Code duplication that should be shared; or a bespoke near-duplicate of an existing canonical helper — reuse the canonical one.
- Abstraction level appropriate: not over-engineered, not too coupled.
- Does a refactor REDUCE complexity or just relocate it? Count the concepts a reader must hold. If unchanged, it isn't cleaner — prefer the restructuring that makes whole branches/modes/layers disappear. Prefer deleting an abstraction to polishing it.
- Feature-specific logic leaking into a shared or general-purpose module? Keep logic in its owning layer. Don't normalize architectural drift.
- Type boundaries explicit? Question gratuitous `any`/`unknown`/optional/casts and silent fallbacks that paper over an unclear invariant — making the boundary explicit often simplifies downstream control flow.

## Structural remedies — propose the move, not just the problem
- Replace a chain of conditionals with a typed model or explicit dispatcher.
- Separate orchestration from business logic so each reads on its own.
- Move feature-specific logic into the package that owns the concept.
- Make a type boundary explicit so downstream branching disappears.
- Prefer the remedy that removes moving pieces over one that spreads the same complexity around.

## Dependency discipline (structure & workflow)
- New dependency: does the existing stack already solve this? Size/bundle impact? Actively maintained? License compatible? Prefer stdlib and existing utilities — every dependency is a liability.
- Upgrades: read the changelog, not just the version number (semver is a promise, not a guarantee). One dependency per change — bulk bumps hide which package broke the build. Review the lockfile diff (transitive graph); lockfile must be committed and never hand-edited. Green suite before AND after.

## Verdict standard
Approve when the change definitely improves code health on this axis, even if
imperfect. Presumptive blockers (propose the simpler design; escalate to
Required only when structure actively worsens): complexity relocated not
reduced; file pushed past healthy size with no decomposition; feature logic in
a shared module; near-duplicate of a canonical helper; silent fallback hiding
an unclear invariant.
