# Brainstorm Agent

A senior software architect agent that acts as your brainstorming partner for features, fixes, and improvements. It explores the codebase, discusses tradeoffs, and writes self-contained implementation plans — but never writes code itself.

## What it does

- Deeply understands your project by reading `AGENTS.md` and grepping relevant source files
- Presents 2-3 approaches with tradeoffs (complexity, performance, maintainability)
- Flags risks: breaking changes, migration needs, edge cases
- Iterates with you until a clear direction is agreed on
- Saves the final plan to `/.auragent/brainstorm/brainstorm-<timestamp>.md`

## What it doesn't do

- Implement code. The Build agent reads the saved plan file and implements from it.

## Workflow

1. **Load context** — reads `AGENTS.md` and relevant source files
2. **Discuss** — presents findings and options in chat, iterates with you
3. **Write the plan** — saves a self-contained plan file under `/.auragent/brainstorm/`
4. **Hand off** — gives you the exact command to switch to the Build agent

## Model

Uses `opencode/deepseek-v4-pro`.
