# AGENTS.md

## What this repo is

A curated collection of agent-agnostic skills, prompt snippets, and tool-specific agent definitions. Not an app or library — this is content that gets installed into other tools via `install.sh`.

## Directory ownership

| Directory | Purpose | Scope |
|---|---|---|
| `skills/` | Agent-agnostic skills (each in its own dir with `SKILL.md`; may also contain `references/`, `assets/`, or `agents/` subdirs) | OpenCode, Codex, Claude Code |
| `opencode/agents/` | OpenCode custom agent definitions | OpenCode only |
| `opencode/commands/` | OpenCode custom commands | OpenCode only |
| `prompts/` | Tool-agnostic prompt snippets | Any AI tool |
| `templates/` | Templates for creating new skills/agents/prompts | N/A |

More tool-specific directories (like `opencode/`) may be added in the future for other agents.

## Naming conventions

- Skills use `bdv-` prefix: `bdv-brainstorm-first`, `bdv-api-handoff`, etc.
- Skill directory names and `name` in frontmatter must match.
- Prompt files use kebab-case: `brainstorm-first.md`, `verify-implementation.md`.
- Agent files use kebab-case: `solution-architect.md`, `experimental-plan.md`.
- Command files use `bdv-` prefix with kebab-case: `bdv-change-report.md`.

## Skill structure

Every skill is a directory containing `SKILL.md` with YAML frontmatter:

```yaml
---
name: bdv-skill-name
description: <triggers for activation>
---
```

Skills may have resource subdirectories:
- `references/` — templates or documents referenced by the skill (e.g. `bdv-api-handoff/references/handoff-template.md`). Use paths relative to the skill root.
- `assets/` — static assets like templates (e.g. `bdv-product-brief/assets/product-brief.md`).
- `agents/` — agent-specific config overrides (e.g. `agents/openai.yaml` for Codex CLI's `allow_implicit_invocation`).

## Agent structure

Each file in `opencode/agents/` has YAML frontmatter with `name`, `description`, `mode`, and `permissions`. Optional fields include `model`, `temperature`, and `hidden`.

```yaml
name: agent-name
description: >-
  When to invoke.
mode: primary|subagent|all
model: <model-id>  # optional; inherits from global config if omitted
temperature: <0.0-1.0>  # optional
permissions:
  read: allow
  edit: deny
  bash: allow|deny|ask
  glob: allow
  grep: allow
  question: allow
  subagent: allow  # allows invoking subagents via the Task tool
```

Permissions support scoped values for finer-grained control. Instead of a flat `allow|deny|ask`, use a glob pattern as a key:

```yaml
permissions:
  edit:
    "/.auragent/plans/**": allow
    "*": deny
  bash:
    "git status": allow
    "*": deny
```

Rules are evaluated in order and the last matching rule wins.

## Command structure

Each file in `opencode/commands/` has YAML frontmatter with `description` and optionally `argument-hint`:

```yaml
description: <short description of what the command does>
argument-hint: "[optional: <description of command arguments>]"
```

The command body is plain Markdown. Use `$ARGUMENTS` to reference the user-provided arguments.

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

- One agent (`solution-architect.md`) has `permission` (singular) in its frontmatter — verify field name if you edit agent files. All other agents and the template use `permissions` (plural).
- The `experimental-plan.md` agent has a `subagent: allow` permission not present in the agent template — this is intentional for that agent type.
- Both agents use `mode: primary`, a field not present in the older agent template. New agents should include it.
- `experimental-plan.md` uses scoped permission values (e.g. `edit: "/.auragent/plans/**": allow`) while `solution-architect.md` uses flat values.
- Command files may include an `argument-hint` field (see `command structure` above).
- Skills are installed by copying the entire subdirectory from `skills/`. Keep all skill resources within the skill's directory.
- Agent definitions are OpenCode-specific and are only installed when the user selects OpenCode.
