# AGENTS.md

## Project and ownership

Agent-stuff authors portable workflows, roles and commands once in `core/`, then
installs them into OpenCode, Codex or Claude Code in global/project scope.
The harness runs the workflow; this repo supplies content and an installer.

Flow: core load/validate → adapter check/render in memory → installer preview,
confirmation and apply → harness discovery/run.

| Location | Owns |
|---|---|
| `core/skills/`, `core/agents/`, `core/commands/` | Portable content and resources |
| `core/src/`, `core/docs/` | Concepts, semantics, schema, validation and public API |
| `adapters/` | Native mapping, compatibility and harness baselines |
| `tool/` | CLI, shared installer and verification tooling |
| `tests/` | Tests, fixtures and migration/content baselines |
| `docs/testing.md` | Cross-module/runtime test procedure |
| `verification/` | Recorded results and evidence, not session instructions |

## Rules

- Core is independent of adapters/installer. Its concepts (i-skill, i-command,
  i-agent) and config semantics are defined in core, not inferred from native names.
- Keep one workflow source. Commands reuse skills; native syntax belongs in adapters.
  Do not restore parallel authoring under `skills/` or `opencode/`, use
  `npx skills add`, or edit generated `dist/` files.
- Use public entrypoints `core/src/index.ts` and `adapters/index.ts`. Adapters do
  not write files or call networks; the shared installer owns filesystem changes.
- Never silently drop config, change role or replace mandatory policy with prompt
  instructions. Explain limitations; ask when an alternative changes agreed semantics.
- Check `git status --short` before editing; trace source and existing tests.
  Preserve existing user edits. Installer operations touch only tracked paths,
  protect untracked/modified files and retain recovery journals on external edits.
- For a new skill, ask about automatic invocation; default explicit-only.
  Preserve established activation preferences when migrating.
- Completed plans/audits belong in Git history unless they retain useful decisions
  or evidence. Do not create archives merely to relocate clutter. Temporary output
  stays outside Git; retained evidence belongs in `verification/`.

## Documentation changes

Documentation changes require explicit approval. Before adding, modifying, deleting,
moving or regenerating any documentation—including README files, agent instructions
and generated references—propose the change in the conversation and wait for approval.
Commands that rewrite documentation require the same approval.

Keep the proposal brief and explain:

- **Files and actions:** which files will change and how.
- **Reader and purpose:** who needs the documentation and what task it supports.
- **Reason and scope:** why the change is necessary and what information will be
  added, changed or removed.
- **Value:** why the information belongs in documentation; for a new file, why an
  existing file cannot serve that purpose.

A general implementation request does not authorize documentation changes. Approval
covers only the proposed scope; ask again if it expands.

Treat docs as a cost in reader time, agent context/tokens and AI spend. Every file
must provide concrete value to a clear reader and task. Keep docs concise, precise
and appropriate for that reader. Prefer revising/consolidating existing docs;
preserve module ownership and essential meaning. Keep one canonical source per
rule and read by task. Avoid duplicate inventories, speculative guides, irrelevant
implementation details and explanations of interactions that explain themselves.
Propose removing redundant or purposeless docs; never remove them without approval.

## Read by task

Read the relevant source and tests alongside these docs; no full-docs startup tour.

| Task | Read |
|---|---|
| User-facing usage/support | [README](README.md) |
| Author/change portable stuff | [Concepts](core/docs/concepts.md), [format/authoring](core/docs/format.md); fields as needed |
| Change core API/schema | [Core API](core/docs/README.md), [fields](core/docs/fields.md) |
| Change native mapping | [Adapter API/development](adapters/README.md), [compatibility](adapters/docs/compatibility.md), relevant harness note |
| Change CLI/installer/build | [Tool](tool/README.md) |
| Test stuff or native behavior | [Testing](docs/testing.md) |
| Change verification tooling/records | [Verification format](tool/docs/verification.md) |

## Requests and communication

Optional prefixes at the start of a direct user request route the approach:

| Prefix | Start with |
|---|---|
| `painpoint:` | Current vs desired behavior, cause and existing stuff |
| `idea:` | Use case, reuse and proposed design |
| `improve:` | Existing target, shortcomings and trade-offs |
| `adapt:` | Core contract, target harness/version and native mapping evidence |
| `check:` | Assessment; no edits unless requested |

Quoted/file examples do not invoke these routes. Ordinary prompts remain valid;
request and session instructions determine action scope. Start from the problem,
recommend a solution before requiring a stuff kind; prefixes grant no extra rights.

Distinguish questions/exploration from requests to implement; a question alone
does not authorize changes. Before substantial work, briefly state the understood
goal, proposed approach, scope and expected outputs, including why new files are
needed. If intent or scope is not agreed, ask and wait; otherwise execute
autonomously within that scope. Propose material scope/semantic changes before
acting. Report meaningful discoveries, blockers and results concisely. Coordinate
in the conversation unless a durable artifact is needed.

After answering, suggest a brief concrete next step when useful; a suggestion is
not permission to execute. When complete, say so rather than inventing work.

## Completion checks

- Implementation: `npm test`; `npm run typecheck` when needed. Content changes:
  `npm run cli -- validate --source .`. Filesystem tests use temporary contexts.
- Schema/field metadata changes: after documentation approval, build, then run
  `npm run core:docs`; never hand-edit generated fields. Keep migration hashes;
  intentional content revisions need a reason.
- Before developing stuff, select harnesses/scopes and required scenarios using
  the testing guide. Validate/render tests do not prove runtime workflow behavior.
  With documentation approval, save the latest results, including failures/blockers,
  and generate the summary with `npm run verification -- report`. Claim verified
  only after each agreed target passes `validate --require-passed`; missing/stale
  evidence remains incomplete.
- Propose updates to the owning doc when behavior changes, README when public
  usage/support changes, under the documentation approval rule. Report required
  documentation changes as pending until approved and applied. Catalog comes from
  `bash install.sh list`, not a manual inventory.
- Publishing, tagging, pushing or sending messages requires a separate request.
