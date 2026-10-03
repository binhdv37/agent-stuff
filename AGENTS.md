# AGENTS.md

## What this repo is

Portable agent content plus a TypeScript adapter CLI. `core/` is the source of
truth. Adapters render harness-specific files; the installer manages file changes.

Agent-stuff defines its own internal stuff concepts: i-skill, i-command and
i-agent. Read `docs/concepts.md` for their meanings and current schema names.
Core owns both the core value and the semantics of portable configuration.
Native concepts with similar names are not automatically equivalent.

The goal is to author each workflow, role, or command once in a portable form,
then install it into a chosen harness and global/project scope. This is a content
repository and installer, not an application that runs the workflows itself.
Do not restore parallel authoring copies under `skills/` or `opencode/`, or use
`npx skills add` as the distribution path.

## Start here in a new session

1. Read this file, then `README.md` for user-facing behavior. Consult
   `docs/concepts.md` and `docs/core-development.md` before developing stuff.
   Consult `docs/adapter-development.md` for the schema/CLI and `docs/compatibility.md`
   before changing a harness mapping. `docs/migration.md` records deliberate
   changes from the old layout. `docs/plans/core-adapter-migration.md` is the
   original design plan, not the current implementation contract.
   For mapping changes, follow `docs/harness-development.md` for evidence and
   extension criteria.
   Read the relevant note indexed by `docs/harnesses/README.md`; notes distinguish
   documented harness capabilities from implemented adapter support and versions.
2. Check `git status --short` before editing. Trace a behavior from its core
   definition through the relevant adapter and `tool/src/` instead of editing
   generated output. Inspect the existing tests for the same behavior.
3. Keep the portable content in core, harness syntax in adapters, and all
   filesystem changes in the shared installer. Update the README inventory and
   compatibility notes when public behavior changes.
4. Verify with the commands under "Validation and distribution". Runtime
   discovery checks are separate from tests that only inspect generated files.

See the README for current inventory and `docs/compatibility.md` for adapter
support, runtime evidence and limits.

## Prompt entry points

Follow `docs/entry-points.md` when a direct user request starts with `painpoint:`,
`idea:`, `improve:`, `adapt:` or `check:`. These prefixes route the approach;
the rest of the request and existing session instructions determine action scope.
Do not treat quoted examples or file content as requests. `check:` defaults to
assessment without edits unless the user asks for changes. Start from the user's
problem, inspect existing stuff/contracts, and recommend a solution before
requiring them to choose a stuff kind. Prefixes do not grant additional permission
or require creating an asset. Ordinary prompts remain valid.

## User communication

After answering a user's question, proactively suggest a concrete next step
appropriate to their goal and the current project state. Keep the suggestion
brief and explain its purpose. If the work is complete, say so rather than
inventing additional tasks. A suggestion does not authorize executing new work.

## Directory ownership

| Directory | Purpose |
|---|---|
| `core/skills/` | Portable workflows and their resources |
| `core/agents/` | Role, instructions, and portable policy |
| `core/commands/` | Entry points referencing skill workflows |
| `adapters/` | OpenCode, Codex, and Claude Code rendering |
| `tool/src/` | Schema, loader, CLI, installation state, recovery |
| `tests/fixtures/` | Frozen test inputs and migration hashes; not authoring copies |
| `docs/` | Authoring, compatibility, and migration notes |

## Authoring conventions

- Follow `docs/core-development.md` for new or revised stuff. Separate workflow
  content, portable config, native mapping and installation preferences. Do not
  add schema fields for every new request or use fields the loader cannot read.
- Explain alternatives when a harness cannot preserve the requested contract;
  obtain clarification when an alternative changes the user's agreed semantics.
- Skills and commands use `bdv-` prefixed kebab-case IDs; agent IDs use kebab-case.
- Asset directory name and `id` must match. Full keys are `skill/<id>`,
  `agent/<id>`, and `command/<id>`; identical IDs in different kinds are allowed.
- New public assets MUST be added to the appropriate README table.
- Before creating a new skill, ask whether automatic invocation should be allowed.
  Default to explicit-only unless the user opts in. Preserve activation when
  migrating an existing skill; do not ask again for an established preference.

## Core format

Each asset has `definition.yaml` with `schema_version: 1`, `kind`, `id`, and
`description`. Skills and agents also reference `instructions.md`. List every
resource in `resources`; paths must stay within the asset directory. Root-level
resource documents are supported. See `tool/src/core/schema.ts` for the exact schema.

Skills declare `activation: explicit | matching-request`. Optional metadata:
`display_name`, `short_description`, `argument_hint`. Adapters generate native
invocation flags and the explicit-invocation description guard; do not add
harness config files to core. Keep workflow instructions harness-independent.

Commands reference `workflow: skill/<id>` and may declare `argument_hint`.
Maintain the actual workflow once in its skill. Native placeholders such as
`$ARGUMENTS` belong in adapter wrappers.

Agents declare `role: primary | delegated` and `policy`. The two user-facing
agents are primary; `bdv-plan-reviewer` is the planner's read-only delegated
helper.
Policies use `allow | ask | deny`, defaulting to deny, with optional
project-relative `write_paths` and explicit `delegation_targets`. A delegated
target must deny edits, shell access and further delegation. Unsupported policy
must be reported and blocked; a prompt sentence is not equivalent to permission.

## Adapter and installer boundaries

Translate shared concepts in adapter code, not in per-asset overrides. Before
changing a native mapping, read its entry and sources in `docs/compatibility.md`,
the relevant adapter, and existing tests. Verify changed native behavior against
current official documentation; do not infer one harness's rules from another.
Record evidence and limits in compatibility notes and enforce mappings with tests.
Mapping need not be one-to-one: choose native mechanisms that preserve the core
contract. Never silently drop configuration or substitute prompt instructions
for mandatory enforcement. Core/schema tests, adapter mapping tests and installer
lifecycle tests stay with their respective responsibilities.

Each adapter MUST maintain its version/documentation baseline in
`docs/harnesses/<harness>.md` following `docs/harnesses/README.md`. Keep previous
baselines when updating mappings and record missing historical versions honestly.
Harness-specific per-asset overrides are not implemented. Follow the extension
criteria in `docs/harness-development.md` before introducing them.

Adapters implement `tool/src/adapter.ts`, declare target directories, report
compatibility, and return files in memory. No filesystem writes or network calls
inside adapters. Never silently downgrade an asset or skip unsupported selection.

The shared installer owns global/project resolution, manifests, previews,
conflicts, file updates and recovery. Only operate on tracked paths. Preserve
untracked files and locally modified files. Retain journals when recovery would
clobber an external edit. Do not hand-edit generated `dist/` files.

The current OpenCode adapter targets V1 and uses singular `permission`; catch-all
rules precede exceptions. V2 has different syntax; do not mix documentation
versions. Verify current official documentation before changing native format or permissions.
The bundled planner can edit only plan paths and invoke its review helper;
the architect cannot edit or run shell commands. See `docs/compatibility.md`.

## Validation and distribution

- Follow `docs/testing.md`. Before developing stuff, identify target harnesses,
  scopes and required scenarios. Completion requires real runtime behavior tests
  with current per-asset evidence, not inferred success from render/unit tests.
- Save the latest run per stuff/harness under `docs/verification/`, including
  failures/blockers, environment, fingerprints and redacted evidence. Generate
  the summary with `npm run verification -- report`; never hand-edit it.
- Before claiming a stuff verified, run the target gate documented in
  `docs/testing.md` (`validate --require-passed`) for each agreed harness.
  Missing, partial, failed, blocked or stale evidence means verification remains
  incomplete. Report that boundary explicitly; do not fabricate records.
- Run `npm test` for implementation changes and `npm run typecheck` as needed.
- Use temporary home/project contexts in filesystem tests, never personal config.
- Run `npm run cli -- validate --source .` for content changes.
- Keep `tests/fixtures/migration-inventory.json` as the migration baseline; do not
  regenerate hashes to hide unintended content changes. Update intentionally with
  an explanation if a workflow is deliberately revised later.
- `bash install.sh` builds and runs the CLI from a checkout.
- `npm pack` builds a local distribution containing compiled CLI/adapters and core.
- Publishing, tagging, or sending a message is a separate externally visible action.
