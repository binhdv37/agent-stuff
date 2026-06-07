# Prompts

Tool-agnostic prompt snippets. Each file in this directory is a self-contained
piece of reusable text that can be copied into any chat, system prompt, or
agent's user message — no OpenCode or Codex frontmatter required.

## Format

Every snippet is a Markdown file with minimal frontmatter and a consistent
structure. Use `templates/snippet.md` as a starting point.

## Conventions

- One concern per file, kebab-case filename.
- Frontmatter is `name` and `description` only (keep it lean).
- The `## Prompt` section contains the actual text, ready to paste.
- Use `<angle-bracket>` placeholders for variables and document them under
  `## Variables`.
- ASCII only.

## Index

- `verify-implementation.md` — force a just-implemented feature to prove
  itself via tests, not narrative.
