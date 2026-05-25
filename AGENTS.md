# AGENTS.md

## Project Context

This repository stores AI agent and skill definitions, primarily as Markdown
files with frontmatter.

Current content areas:
- `opencode/agents/`: OpenCode-style agent definitions
- `skills/`: Codex-style skills (`SKILL.md`)

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

## Codex Skill Conventions

Files under `skills/` should:
- Be named as `skills/<skill-name>/SKILL.md`.
- Include minimal frontmatter with `name` and `description`.
- Describe trigger conditions in `description` ("Use when ...").
- Keep steps explicit and executable in Codex workflows.

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

