# Agent Stuff

Portable workflows for OpenCode, Codex, and Claude Code.

Write instructions once in `core/`. The TypeScript CLI validates the definitions,
uses an adapter to generate harness files, and installs the selected assets into
a global or project directory.

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
| `prompts/` | Personal drafts, excluded from distribution |

## Current adapter support

| Adapter | Skills | Commands | Agents |
|---|---|---|---|
| OpenCode | All 11; explicit invocation has a reported limitation | Both commands | Both primary agents and their read-only review helper |
| Codex | All 11, including native invocation policy | Invoke corresponding skills | Not mapped |
| Claude Code | All 11, also available as slash commands | Use skill slash commands | Primary roles not mapped |

See [compatibility](docs/compatibility.md) for sources, runtime checks and policy
limitations. [Development guide](docs/adapter-development.md) explains the schema,
CLI and tests; [migration notes](docs/migration.md) list intentional changes.

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

Reusable workflows. Most skills require an explicit request; `bdv-grill-me` and `bdv-smart-commit` may activate from matching requests.

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
| **bdv-smart-commit** | Stages changes, generates a Conventional Commit, commits | "commit", "commit this" |
| **bdv-teach** | Creates a stateful learning workspace with lessons, trusted resources, and learning records | "teach me <topic>", "help me learn <topic>" |
