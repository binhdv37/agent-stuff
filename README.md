# Agent Stuff

> Ready-to-use AI agents, skills, and prompt snippets for OpenCode, Codex, and Claude Code.

[![GitHub last commit](https://img.shields.io/github/last-commit/binhdv37/agent-stuff?style=flat-square)](https://github.com/binhdv37/agent-stuff)

## What You Get

A curated collection of agent definitions, modular skills, and drop-in prompts you can install in seconds. Each one is battle-tested and ready to enhance your AI coding workflow.

- **Agents** — Specialized AI roles (planner, architect) with defined permissions and behavior
- **Skills** — Trigger-based workflows (brainstorming, interview prep, API handoff) activated by what you say
- **Prompts** — Copy-paste text snippets that work in any chat, any tool

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/binhdv37/agent-stuff/main/install.sh | bash
```

The installer will ask which AI agent you use (OpenCode, Codex, or Claude Code) and whether to install globally or for a single project.

## Agents

Specialized roles that extend your AI agent's capabilities. Each has a defined model, permissions, and workflow.

| Agent | What It Does | Best For |
|-------|-------------|----------|
| **experimental-plan** | Explores code and writes step-by-step implementation plans | Planning before coding |
| **solution-architect** | Designs system architecture and evaluates trade-offs | Technical design decisions |

## Commands

Custom OpenCode and Claude Code commands — type `/` followed by the command name.

| Command | What It Does | Usage |
|---------|-------------|-------|
| **bdv-change-report** | Generates a high-level change report for recent code changes | `/bdv-change-report` or `/bdv-change-report src/auth` |
| **bdv-explain-code** | Explains existing code for quick review — no diff needed | `/bdv-explain-code <file/dir/function>` |

> Commands are installed to `~/.config/opencode/commands/` (global) or `.opencode/commands/` (local) for OpenCode, and `~/.claude/commands/` (global) or `.claude/commands/` (local) for Claude Code.

## Skills

Trigger-based workflows. Say the right phrase and the skill activates automatically.

| Skill | What It Does | Say This to Trigger |
|-------|-------------|-------------------|
| **bdv-api-handoff** | Generates FE-ready API docs from backend code | "document this API", "hand off" |
| **bdv-brainstorm-first** | Forces brainstorming before any code is written | "brainstorm first", "let's brainstorm" |
| **bdv-change-report** | Generates a high-level report of code changes | "change report", "summarize the changes" |
| **bdv-explain-code** | Explains existing code for quick review — no diff needed | "explain this code", "walk me through" |
| **bdv-grill-me** | Interviews you relentlessly on a plan until it's solid | "grill me", "stress-test my plan" |
| **bdv-ielts-speaking-coach** | Interactive IELTS Speaking practice with scoring | "IELTS speaking", "practice IELTS" |
| **bdv-interview-coach** | Mock technical interview with model answers | "interview", "mock interview" |
| **bdv-product-brief** | Turns vague ideas into structured product briefs | "I have an idea for..." |
| **bdv-smart-commit** | Stages changes, generates a Conventional Commit, commits | "commit", "commit this" |

## Prompts

Drop-in text snippets that work anywhere — OpenCode, ChatGPT, Claude, or your system prompt.

| Prompt | What It Does | When to Use |
|--------|-------------|-------------|
| **brainstorm-first** | Keeps an agent in brainstorming mode, blocks implementation | Before choosing an approach |
| **verify-implementation** | Forces proof that a feature works via tests, not explanation | After implementing something |
