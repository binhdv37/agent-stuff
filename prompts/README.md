# Prompts

The author's personal collection of quick and draft prompts. These files are
not part of the end-user offering or installer; they are reusable text for the
author to copy into chats, system prompts, or agent messages.

## Format

Every prompt is a Markdown file with minimal frontmatter and a consistent
structure.

## Conventions

- One concern per file, kebab-case filename.
- Frontmatter is `name` and `description` only (keep it lean).
- The `## Prompt` section contains the actual text, ready to paste.
- Use `<angle-bracket>` placeholders for variables and document them under
  `## Variables`.
- ASCII only.

## Index

- `brainstorm-first.md` — keep an agent in brainstorming mode before implementation.
- `verify-implementation.md` — force a just-implemented feature to prove
  itself via tests, not narrative.
