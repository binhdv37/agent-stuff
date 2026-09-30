# AGENTS.md

## What this repo is

Portable agent content plus a TypeScript adapter CLI. `core/` is the source of
truth. Adapters render harness-specific files; the installer manages file changes.

The goal is to author each workflow, role, or command once in a portable form,
then install it into a chosen harness and global/project scope. This is a content
repository and installer, not an application that runs the workflows itself.
Do not restore parallel authoring copies under `skills/` or `opencode/`, or use
`npx skills add` as the distribution path.

## Start here in a new session

1. Read this file, then `README.md` for user-facing behavior. Consult
   `docs/adapter-development.md` for the schema/CLI and `docs/compatibility.md`
   before changing a harness mapping. `docs/migration.md` records deliberate
   changes from the old layout. `docs/plans/core-adapter-migration.md` is the
   original design plan, not the current implementation contract.
   For asset or harness changes, follow `docs/harness-development.md`: it defines
   the development flow, required evidence, and boundaries for future extensions.
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

Current inventory: 11 skills, two primary agents, one read-only delegated agent,
and two commands (16 assets). OpenCode renders all of them, with limited
enforcement of explicit skill invocation. Codex and Claude Code currently render
skills only; their command and agent assets are reported unsupported. The user
confirmed a successful manual Claude Code runtime test on 2026-09-30. See
`docs/compatibility.md` for the exact checks and limits.

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

- Run `npm test` for implementation changes and `npm run typecheck` as needed.
- Use temporary home/project contexts in filesystem tests, never personal config.
- Run `npm run cli -- validate --source .` for content changes.
- Keep `tests/fixtures/migration-inventory.json` as the migration baseline; do not
  regenerate hashes to hide unintended content changes. Update intentionally with
  an explanation if a workflow is deliberately revised later.
- `bash install.sh` builds and runs the CLI from a checkout.
- `npm pack` builds a local distribution containing compiled CLI/adapters and core.
- Publishing, tagging, or sending a message is a separate externally visible action.
