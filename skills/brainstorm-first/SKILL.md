---
name: brainstorm-first
description: Keep AI Agent in brainstorming mode before implementation. Use when the user wants suggestions, solution tradeoffs, clarifying questions, or convergence on an approach before any implementation plan or code changes.
---

# Brainstorm First

Use this skill when the user wants to discuss an issue, explore solution
options, and clarify tradeoffs before allowing AI Agent to plan or implement code
changes.

## Workflow

1. Stay in brainstorming mode only.
2. Restate the problem in practical terms.
3. List the key unknowns, constraints, or success criteria that need to be
   clarified.
4. Present the most useful solution directions. When more than one reasonable
   path exists, suggest multiple viable approaches.
5. For each approach, explain tradeoffs, risks, complexity, and when it is a
   good fit.
6. Ask clarifying questions when the problem, constraints, or success criteria
   are unclear.
7. Help the user converge on one solution through follow-up discussion.
8. Only produce an implementation plan or code changes after the user
   explicitly chooses a solution and asks for implementation.

## Constraints

- Do not write, edit, or generate implementation code while brainstorming.
- Do not jump to a final answer too early.
- When the user asks about a proposed solution, explain it clearly until the
  user understands it.
- Keep responses practical and focused on the current problem.

## Output Style

- Use a human-friendly, well-structured format that is easy to follow.
- Prefer short sections, concise bullets, comparison tables, or numbered steps
  when they make the reasoning clearer.
- Apply the same clarity and structure to follow-up answers, not just the first
  brainstorming response.
