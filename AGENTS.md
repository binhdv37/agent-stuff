# AGENTS.md

## Project Context

This repository stores AI agent and skill definitions, primarily as Markdown
files with frontmatter.

Current content areas:
- `opencode/agents/`: OpenCode agent definitions
- `skills/`: Agent skills (`SKILL.md`), all prefixed with `bdv-`
- `prompts/`: tool-agnostic prompt snippets
- `templates/`: scaffolds for the formats above
- `install.sh`: one-command installer for skills and agents

This is not a runtime application repository. There is no build, server, or app
entrypoint to run.

## Goals For Changes

When making changes in this repo:
- Preserve clear, reusable instructions for agent workflows.
- Keep prompts operational and unambiguous.
- Favor small, focused edits over broad rewrites.

## Editing Rules

1. Keep existing folder structure unless explicitly asked to reorganize.
2. Use ASCII by default.
3. Preserve frontmatter keys and formatting style used by each file family.
4. Do not silently delete historical files (for example `*.old`) unless asked.
5. If migrating content between OpenCode agents and Codex skills, keep behavior
   equivalent and call out non-portable fields.

## OpenCode Agent Conventions

Files under `opencode/agents/` should:
- Start with valid frontmatter.
- Include clear role, workflow, and constraints.
- Keep permissions intentional and minimal.
- Avoid tool references that are unavailable in the target environment.

## Agent Skill Conventions

Files under `skills/` should:
- Be named as `skills/bdv-<skill-name>/SKILL.md` (use `bdv-` prefix).
- Include minimal frontmatter with `name` and `description`.
- Describe trigger conditions in `description` ("Use when ...").
- Keep steps explicit and executable in agent workflows.

## Tool-Agnostic Prompt Conventions

Files under `prompts/` should:
- Be named as `prompts/<kebab-case-name>.md` (one concern per file).
- Include minimal frontmatter with `name` and `description` only.
- Put the actual reusable text under a `## Prompt` heading.
- Document `<placeholder>` substitutions under a `## Variables` heading.
- Stay tool-agnostic — no OpenCode or Codex frontmatter fields.

## Template Conventions

Files under `templates/` are scaffolds and may contain placeholders. They are
not consumed by any runtime and should be kept minimal and self-explanatory.

## Validation Checklist

Before finishing a change:
1. Verify file paths and names are correct.
2. Verify frontmatter blocks are present and not malformed.
3. Verify any referenced directories or files exist.
4. Confirm no unrelated files were modified.

## Git Hygiene

- Prefer one logical change per commit.
- Use conventional commit style when practical (`docs:`, `chore:`, `feat:`).
- Do not rewrite commit history unless explicitly requested.

