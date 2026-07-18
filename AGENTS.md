# AGENTS.md

## What this repo is

A curated collection of agent-agnostic skills and tool-specific agent definitions. Not an app or library — this is content that gets installed into other tools via `install.sh`. The `prompts/` directory contains the author's personal draft prompts and is not part of the end-user offering.

## Directory ownership

| Directory | Purpose | Scope |
|---|---|---|
| `skills/` | Agent-agnostic skills (each in its own dir with `SKILL.md`; may also contain `references/`, `assets/`, or `agents/` subdirs) | OpenCode, Codex, Claude Code |
| `opencode/agents/` | OpenCode custom agent definitions | OpenCode only |
| `opencode/commands/` | OpenCode custom commands | OpenCode only |
| `prompts/` | Author's personal quick/draft prompts | Author only |

More tool-specific directories (like `opencode/`) may be added in the future for other agents.

## Naming conventions

- Skills use `bdv-` prefix: `bdv-brainstorm-first`, `bdv-api-handoff`, etc.
- Skill directory names and `name` in frontmatter must match.
- Prompt files use kebab-case: `brainstorm-first.md`, `verify-implementation.md`.
- Agent files use kebab-case: `solution-architect.md`, `experimental-plan.md`.
- Command files use `bdv-` prefix with kebab-case: `bdv-change-report.md`.

## Conventions when adding new assets

When you create a new skill, command, or agent in this repo, you MUST also add
the corresponding entry to `README.md` in the appropriate table. The user
should not need to explicitly ask for this. Personal prompts are intentionally
not listed in the root README.

## Skill structure

Every skill is a directory containing `SKILL.md` with YAML frontmatter:

```yaml
---
name: bdv-skill-name
description: <triggers for activation>
---
```

Before creating a skill, always ask whether it should be eligible for automatic
model invocation. Default to explicit-only unless the user opts in. For an
explicit-only skill:

- Add `disable-model-invocation: true` to its `SKILL.md` frontmatter.
- Add `agents/openai.yaml` with `policy.allow_implicit_invocation: false`.
- End its description with: `Do not invoke automatically. Use this skill only when the user explicitly requests this workflow or names the skill.`

`disable-model-invocation` and `agents/openai.yaml` are respected by agents
that support them. OpenCode ignores unknown skill frontmatter, so the
description is its in-skill guard; users can enforce approval through OpenCode
`permission.skill` rules.

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

## Personal prompt structure

Each `prompts/*.md` file is an author-maintained, ready-to-paste draft with minimal frontmatter (`name`, `description`) and a `## Prompt` section. Use `<angle-bracket>` placeholders for variables and document them under `## Variables`.

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

- One agent (`solution-architect.md`) has `permission` (singular) in its frontmatter — verify field name if you edit agent files. All other agents use `permissions` (plural).
- The `experimental-plan.md` agent has a `subagent: allow` permission — this is intentional for that agent type.
- Both agents use `mode: primary`. New agents should include it.
- `experimental-plan.md` uses scoped permission values (e.g. `edit: "/.auragent/plans/**": allow`) while `solution-architect.md` uses flat values.
- Command files may include an `argument-hint` field (see `command structure` above).
- Skills are installed by copying the entire subdirectory from `skills/`. Keep all skill resources within the skill's directory.
- Agent definitions are OpenCode-specific and are only installed when the user selects OpenCode.
