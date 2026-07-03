---
name: bdv-brainstorm-first
description: Use ONLY when the user explicitly asks to enter brainstorming mode by name (e.g. "brainstorm first", "let's brainstorm", "start a brainstorming session"). Do NOT trigger on general discussion, questions, requests for suggestions, or solution exploration unless the user explicitly invokes this skill by name.
---

# Brainstorm First

The user has explicitly invoked a deep brainstorming session. Discuss the issue,
explore solution options, and clarify tradeoffs. Do not plan or implement code
changes until the session is explicitly ended.

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
8. Do NOT produce an implementation plan or code changes while in brainstorming
   mode. If the user asks for implementation, remind them to end the
   brainstorming session first (e.g. "end brainstorming", "done brainstorming").
9. After the session ends, offer to save the discussion to a markdown file in
   `.bdv_brainstorm/brainstorm-<short-topic>-DD-MM-YY.md`.

## Constraints

- Do not write, edit, or generate implementation code while brainstorming.
- Do not jump to a final answer too early.
- When the user asks about a proposed solution, explain it clearly until the
  user understands it.
- Keep responses practical and focused on the current problem.
- End brainstorming mode only when the user explicitly says so (e.g. "end
  brainstorming", "done brainstorming", "let's implement"). Once the session
  ends, drop all brainstorming constraints and proceed normally.
- After the session ends, ask the user: "Save this brainstorming session to a
  markdown file?" If yes, write the discussion to
  `.bdv_brainstorm/brainstorm-<short-topic>-DD-MM-YY.md` (create the
  `.bdv_brainstorm/` directory if it does not exist). Use a concise, structured
  markdown format that captures the problem, approaches discussed, tradeoffs,
  and the converged solution. If no, just end normally.

## Output Style

- Use a human-friendly, well-structured format that is easy to follow.
- Prefer short sections, concise bullets, comparison tables, or numbered steps
  when they make the reasoning clearer.
- Apply the same clarity and structure to follow-up answers, not just the first
  brainstorming response.
