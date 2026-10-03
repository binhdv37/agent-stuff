# Agent Stuff

Portable agent content for OpenCode, Codex, and Claude Code.

Agent-stuff develops its own reusable components, called **stuff**: `i-skill`
(capability/workflow), `i-command` (user-invoked prompt/template), and `i-agent`
(agent identity, role and working instructions). Core defines their content and
portable configuration semantics; adapters translate that intent into native
harness mechanisms. These concepts need not map one-to-one to native concepts.
See the [glossary](docs/concepts.md) and [stuff development flow](docs/core-development.md).
The current schema still uses `skill`, `command` and `agent`; standalone command
templates and additional config types require explicit schema/adapter development.

Write instructions once in `core/`. The TypeScript CLI validates the definitions,
uses an adapter to generate harness files, and installs the selected assets into
a global or project directory.

The harness runs the installed workflows. Personal drafts are not part of this
repository.

## Start from a problem or idea

When working with an AI Agent in this repo, use a prefix to state your intent:

| Prefix | Use it for |
|---|---|
| `painpoint:` | An unwanted behavior or frustrating experience |
| `idea:` | A new capability you want to explore |
| `improve:` | Improving existing stuff |
| `adapt:` | Mapping stuff to a harness or target version |
| `check:` | Assessing content or behavior; defaults to no edits |

```text
painpoint: agent cứ tự commit khi t chưa cho phép.
T muốn chỉ commit khi t yêu cầu rõ ràng. Gợi ý cách xử lý trước.
```

You do not need to choose a stuff kind first. The Agent investigates and recommends
a solution; ask it to implement when you want changes. Prefixes are a repo prompt
convention guided by `AGENTS.md`, not CLI commands. Ordinary prompts still work.
See [entry points](docs/entry-points.md) for scope and examples.

## Install from a checkout

Requires Node.js 22+ and npm. The filesystem installer is tested on macOS; its
POSIX launcher and durability operations are intended for macOS/Linux.

```bash
git clone https://github.com/binhdv37/agent-stuff.git
cd agent-stuff
bash install.sh
```

Choose a harness, global/project scope, assets, then review and apply the changes.
The CLI shows unsupported assets and compatibility limitations before installing.
To use a particular source version, check out that tag or commit before building.

For scripted use:

```bash
npm ci
npm run build

# Preview all compatible OpenCode assets in an existing project
npm run cli -- install --agent opencode --scope project --project /path/to/project \
  --compatible-only --dry-run

# Install one Codex skill globally
npm run cli -- install --agent codex --scope global \
  --only skill/bdv-api-handoff --yes

# Preview an update or removal
npm run cli -- update --agent codex --scope global --dry-run
npm run cli -- uninstall --agent codex --scope global --dry-run
```

OpenCode explicit-only skills require `--accept-limitations` when applying in
non-interactive mode: the explicit invocation rule is expressed in instructions,
without native enforcement by this adapter. `--yes` does not bypass conflicts.

The CLI defaults to the core bundled with it. Use `--source /path/to/checkout` to
work with another checkout. Update defaults to the source recorded at installation.
For an interrupted installation, use `recover` with the same harness and scope.

Existing files from the old installer are untracked and cause a conflict. Back up
and move the conflicting legacy files before installing; the CLI does not overwrite
or adopt them automatically. Uninstall preserves unrelated files and refuses to
remove managed files that have local edits.

## Layout

| Directory | Purpose |
|---|---|
| `core/skills/` | Workflow metadata, instructions, and supporting resources |
| `core/agents/` | Portable role and policy definitions |
| `core/commands/` | Entry points referencing a skill workflow |
| `adapters/` | Harness-specific rendering and compatibility decisions |
| `tool/src/` | CLI, validation, installation, and recovery |
| `tests/` | Fixtures, migration checks, and filesystem lifecycle tests |

## Current adapter support

| Adapter | Skills | Commands | Agents |
|---|---|---|---|
| OpenCode | All 11; explicit invocation has a reported limitation | Both commands | Two primary agents and the planner's read-only review helper |
| Codex | All 11, including native invocation policy | No separate command files; invoke the corresponding skills | Not mapped |
| Claude Code | All 11, also available as slash commands | No separate command files; use skill slash commands | Not mapped |

See [compatibility](docs/compatibility.md) for runtime checks and policy limits;
[migration notes](docs/migration.md) list intentional changes from the old layout.

## Working on this repository

Start with [AGENTS.md](AGENTS.md) for the authoring rules and a new-session
checklist. Write portable content in `core/`, harness-specific output rules in
`adapters/`, and installation behavior in `tool/src/`. Generated `dist/` files
are build output. Add new public assets to the tables below, then run
`npm run cli -- validate --source .` for content changes and `npm test` for
implementation changes. The [development guide](docs/adapter-development.md)
has CLI and recovery details; [compatibility](docs/compatibility.md) separates
filesystem tests from runtime checks.
Follow the [stuff development flow](docs/core-development.md) when authoring,
and the [mapping guide](docs/harness-development.md) when changing adapters.
The [harness research notes](docs/harnesses/README.md) explain native concepts,
version differences, adapter reference versions and documentation baselines,
and the checks needed before extending a mapping. Reference records preserve
what a mapping was based on; the CLI does not detect or gate harness versions.
The [activation smoke runner](docs/adapter-development.md#smoke-activation-từ-checkout)
checks discovery and optional model behavior in temporary global/project contexts;
recorded outcomes and pending checks are in compatibility notes.

The inventory below contains 16 assets: 11 skills, three agents, and two commands.

## Verification

See the [verification summary](docs/verification/README.md) for the latest
per-stuff/harness results, missing coverage and stale evidence. New or revised
stuff must pass real runtime scenarios on agreed targets before being reported
verified. `npm test` checks implementation and record integrity; it does not
prove every workflow works. The [testing guide](docs/testing.md) defines the
required stages, evidence format and completion gate.

## Agents

OpenCode installs both primary agents. Selecting the planner also installs its
read-only review helper.

| Agent | What It Does | Permission boundary |
|---|---|---|
| **experimental-plan** | Explores code and writes implementation plans | Can edit only `.auragent/plans/` and call the review helper |
| **solution-architect** | Designs architecture and evaluates trade-offs | Read-only; shell and edits denied |
| **bdv-plan-reviewer** | Reads code and critiques a proposed plan for the planner | Read-only subagent; shell, edits and further delegation denied |

## Commands

OpenCode commands share the instructions of the corresponding core skill.

| Command | What It Does | Usage |
|---|---|---|
| **bdv-change-report** | Generates a high-level change report | `/bdv-change-report [scope]` |
| **bdv-explain-code** | Explains existing code | `/bdv-explain-code <target>` |

## Skills

Reusable workflows. All skills require explicit invocation except `bdv-grill-me`,
which may activate from matching requests.

| Skill | What It Does | Say This to Trigger |
|-------|-------------|-------------------|
| **bdv-api-handoff** | Generates FE-ready API docs from backend code | "document this API", "hand off" |
| **bdv-brainstorm-first** | Forces brainstorming before any code is written | "brainstorm first", "let's brainstorm" |
| **bdv-change-report** | Generates a high-level report of code changes | "change report", "summarize the changes" |
| **bdv-explain-code** | Explains existing code for quick review — no diff needed | "explain this code", "walk me through" |
| **bdv-grill-me** | Interviews you relentlessly on a plan until it's solid | "grill me", "stress-test my plan" |
| **bdv-handoff** | Creates a concise, redacted handoff document for the next agent or session | "create a session handoff", "handoff for the next agent" |
| **bdv-ielts-speaking-coach** | Interactive IELTS Speaking practice with scoring | "IELTS speaking", "practice IELTS" |
| **bdv-interview-coach** | Mock technical interview with model answers | "interview", "mock interview" |
| **bdv-product-brief** | Turns vague ideas into structured product briefs | "I have an idea for..." |
| **bdv-smart-commit** | Reads changes, warns about edits outside session work, proposes exact-file staging + a Conventional Commit for approval, then offers separately approved push and a PR/MR link | Explicitly invoke `bdv-smart-commit` |
| **bdv-teach** | Creates a stateful learning workspace with lessons, trusted resources, and learning records | "teach me <topic>", "help me learn <topic>" |
