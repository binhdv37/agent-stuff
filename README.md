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
- `brainstorm.md.old` is an older brainstorm-agent definition that appears to be
  deprecated but retained for reference.

### Codex skills

Skill definitions live in `skills/`.

- `skills/roll-dice/SKILL.md` defines a simple skill for rolling dice using a
  random number command in shell or PowerShell.

### Tool-agnostic prompts

Reusable prompt snippets live in `prompts/`.

- `prompts/README.md` is the index. Add new snippets by copying
  `templates/snippet.md` and filling it in.

### Templates

Scaffolds for new assets live in `templates/`.

- `templates/agent.md` — starting point for a new OpenCode agent
- `templates/skill.md` — starting point for a new Codex skill
- `templates/snippet.md` — starting point for a new tool-agnostic snippet

## Current State

The repository currently has no package manifest, build system, tests, or
runtime entrypoint. Most files are Markdown documents with frontmatter consumed
by external agent tools, plus a small set of tool-agnostic prompt snippets.

Git history indicates the repository is being used to iterate on reusable agent
definitions, especially planning, brainstorming, architecture, and code
explanation workflows.

## Notes

- Some agents assume an `AGENTS.md` file may exist in the target project they
  are used against. This repository itself does not currently include one.
- Planning-oriented agents write to `/.auragent/...` paths according to their
  configured permissions and workflow instructions.
- The `.old` brainstorm file should be treated as historical/reference material
  unless intentionally restored.
