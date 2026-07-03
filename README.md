# Agent Stuff

This repository is a personal collection of agent and skill definitions for AI
coding workflows. It is not currently a runnable application or library; it is a
set of prompt/configuration assets that can be copied into, referenced by, or
adapted for local agent tooling.

## Contents

### OpenCode agents

Agent definitions live in `opencode/agents/`.

- `code_explainer.md` defines a read-only code explanation agent. It is designed
  to inspect source files before answering, trace dependencies, explain code at
  an appropriate level of depth, and include a lightweight quality review.
- `solution_architect.md` defines a solution architecture and brainstorming
  agent. It focuses on clarifying requirements, comparing technical approaches,
  evaluating tradeoffs, and producing actionable architecture guidance.
- `experimental_plan.md` defines a planning-only agent. It explores a codebase,
  designs an implementation approach, and writes a plan file for a separate
  execution agent to follow.

### Agent skills

Skill definitions live in `skills/`. All skills use the `bdv-` prefix and follow
the open Agent Skills standard (`SKILL.md` with YAML frontmatter).

- `bdv-brainstorm-first` — deep brainstorming mode before implementation
- `bdv-grill-me` — stress-test a plan or design through relentless Q&A
- `bdv-ielts-speaking-coach` — guided IELTS Speaking practice sessions
- `bdv-interview-coach` — mock technical interview practice
- `bdv-product-brief` — turn rough product ideas into structured briefs
- `bdv-api-handoff` — generate frontend-ready API handoff docs

### Tool-agnostic prompts

Reusable prompt snippets live in `prompts/`.

- `prompts/README.md` is the index. Add new snippets by copying
  `templates/snippet.md` and filling it in.

### Templates

Scaffolds for new assets live in `templates/`.

- `templates/agent.md` — starting point for a new OpenCode agent
- `templates/skill.md` — starting point for a new Codex skill
- `templates/snippet.md` — starting point for a new tool-agnostic snippet

## Installer

`install.sh` provides a one-command setup for installing skills into your
local agent environment. It supports OpenCode, Codex, and Claude Code, with
both global and per-project installation.

```bash
bash install.sh
```

## Current State

The repository stores reusable agent definitions and skills as Markdown files
with frontmatter, consumed by external agent tools. `install.sh` copies
skills and agents to the appropriate directories for your chosen agent.
