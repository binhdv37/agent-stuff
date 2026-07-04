# AGENTS.md

## What this repo is

A curated collection of agent-agnostic skills, prompt snippets, and tool-specific agent definitions. Not an app or library — this is content that gets installed into other tools via `install.sh`.

## Directory ownership

| Directory | Purpose | Scope |
|---|---|---|
| `skills/` | Agent-agnostic skills (each in its own dir with `SKILL.md`) | OpenCode, Codex, Claude Code |
| `opencode/agents/` | OpenCode custom agent definitions | OpenCode only |
| `opencode/commands/` | OpenCode custom commands | OpenCode only |
| `prompts/` | Tool-agnostic prompt snippets | Any AI tool |
| `templates/` | Templates for creating new skills/agents/prompts | N/A |

More tool-specific directories (like `opencode/`) may be added in the future for other agents.

## Naming conventions

- Skills use `bdv-` prefix: `bdv-brainstorm-first`, `bdv-api-handoff`, etc.
- Skill directory names and `name` in frontmatter must match.
- Prompt files use kebab-case: `brainstorm-first.md`, `verify-implementation.md`.
- Agent files use snake_case: `code_explainer.md`, `experimental_plan.md`, `solution_architect.md`.
- Command files use kebab-case: `change-report.md`.

## Skill structure

Every skill is a directory containing `SKILL.md` with YAML frontmatter:

```yaml
---
name: bdv-skill-name
description: <triggers for activation>
---
```

Skills may have a `references/` subdirectory (e.g. `bdv-api-handoff/references/handoff-template.md`). When a skill references files in `references/`, use paths relative to the skill root.

## Agent structure

Each file in `opencode/agents/` has YAML frontmatter with `name`, `description`, and `permissions`:

```yaml
name: agent_name
description: >-
  When to invoke.
permissions:
  read: allow
  edit: deny
  bash: allow|deny|ask
  glob: allow
  grep: allow
  question: allow
```

## Prompt snippet structure

Each `prompts/*.md` file has minimal frontmatter (`name`, `description`) and a `## Prompt` section containing the ready-to-paste text. Use `<angle-bracket>` placeholders for variables and document them under `## Variables`.

## Template placeholders

Template files (`templates/`) use `<angle-bracket>` placeholders (e.g. `<kebab-case-agent-name>`, `<role description>`). When generating new content from templates, replace all angle-bracket placeholders with concrete values.

## Installation flow (install.sh)

1. User chooses agent (OpenCode / Codex / Claude Code)
2. User chooses global or local install
3. Script downloads the repo tarball, extracts skills into the correct target dir
4. For OpenCode only: also copies agents from `opencode/agents/` and commands from `opencode/commands/`

Target paths:
- **OpenCode**: `~/.config/opencode/skills/` (global) or `.opencode/skills/` (local)
- **Codex**: `~/.agents/skills/` or `.agents/skills/`
- **Claude Code**: `~/.claude/skills/` or `.claude/skills/`
- OpenCode agents: `~/.config/opencode/agents/` or `.opencode/agents/`
- OpenCode commands: `~/.config/opencode/commands/` or `.opencode/commands/`

## Known quirks

- One agent (`solution_architect.md`) has `permission` (singular) in its frontmatter — verify field name if you edit agent files. All other agents and the template use `permissions` (plural).
- The `experimental_plan.md` agent has a `subagent: allow` permission not present in the agent template — this is intentional for that agent type.
- Skills are installed by copying the entire subdirectory from `skills/`. Keep all skill resources within the skill's directory.
- Agent definitions are OpenCode-specific and are only installed when the user selects OpenCode.
