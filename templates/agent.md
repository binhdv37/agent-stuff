---
name: <kebab-case-agent-name>
description: >-
  <one-line summary; describe when to invoke this agent>
model: <model-id>
temperature: <0.0-1.0>
permissions:
  read: allow
  edit: deny
  bash: ask
  glob: allow
  grep: allow
  question: allow
---

You are <role description>. <One-sentence framing of the agent's purpose.>

## Role

<What the agent is responsible for.>

## Workflow

### Step 1 — <Name>

<Steps the agent should follow.>

### Step 2 — <Name>

<More steps.>

## Constraints

- <Hard rule the agent must respect.>
- <Another rule.>
