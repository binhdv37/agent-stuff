# AGENTS.md

## What this repo is

Portable agent content plus a TypeScript adapter CLI. `core/` is the source of
truth. Adapters render harness-specific files; the installer manages file changes.
`prompts/` contains personal drafts and is excluded from distribution.

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
| `prompts/` | Personal ready-to-paste drafts |

## Authoring conventions

- Skills and commands use `bdv-` prefixed kebab-case IDs; agent IDs use kebab-case.
- Asset directory name and `id` must match. Full keys are `skill/<id>`,
  `agent/<id>`, and `command/<id>`; identical IDs in different kinds are allowed.
- New public assets MUST be added to the appropriate README table.
- Before creating a new skill, ask whether automatic invocation should be allowed.
  Default to explicit-only unless the user opts in. Preserve activation when
  migrating an existing skill; do not ask again for an established preference.
- Personal prompts use minimal `name`/`description` frontmatter, a `## Prompt`
  section, angle-bracket placeholders and a `## Variables` section.

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

Agents declare `role: primary | delegated` and `policy`. Existing agents are
primary. Preserve the planner's intent to delegate; do not silently remove it to
make an adapter pass. Policies use `allow | ask | deny`, defaulting to deny, with
optional project-relative `write_paths`. Unsupported policy must be reported and
blocked; a prompt sentence is not equivalent to enforced permission.

## Adapter and installer boundaries

Adapters implement `tool/src/adapter.ts`, declare target directories, report
compatibility, and return files in memory. No filesystem writes or network calls
inside adapters. Never silently downgrade an asset or skip unsupported selection.

The shared installer owns global/project resolution, manifests, previews,
conflicts, file updates and recovery. Only operate on tracked paths. Preserve
untracked files and locally modified files. Retain journals when recovery would
clobber an external edit. Do not hand-edit generated `dist/` files.

OpenCode uses singular `permission`; catch-all rules precede exceptions. Verify
current official documentation before changing native format or permissions.
The bundled agents currently have unsupported policy combinations; see
`docs/compatibility.md` before claiming they can be installed.

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
