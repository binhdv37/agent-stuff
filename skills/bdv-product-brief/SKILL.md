---
name: bdv-product-brief
description: Create a product brief for requests such as "create a product brief", "flesh this out", or "turn this idea into a product brief". Do not invoke automatically. Use this skill only when the user explicitly requests this workflow or names the skill.
disable-model-invocation: true
---

# Product Brief

Interview the user in 4 groups, one at a time. Don't force answers; unknowns go
to Open Questions.

1. Problem & users: what problem, for whom, evidence it's real
2. Value proposition: one sentence on why this vs alternatives
3. Feature brainstorm: list everything imaginable, no filtering yet
4. Constraints: platform, timeline, team/budget, technical

After the user's brainstorm, actively suggest additions they likely haven't
considered: adjacent features, common patterns for this type of product,
edge-case user needs, monetization angles, or risks. Mark these clearly as your
suggestions, for example "Suggested by AI", so the user can accept or reject
each one.

Then draft using `assets/product-brief.md`. Tag each feature, user's and
suggested, as **Core** if it directly solves the stated problem or **Extension**
if it is future or nice-to-have.

Push back on vague problem statements or feature lists that aren't grounded in a
real problem.

Ask the user to review and iterate until they explicitly agree that the proposed
Product Brief is ready.

After agreement, create `docs/product/` if it does not exist, then write the
brief to `docs/product/product-brief.md`. Do this automatically without asking
for a destination first.

If `docs/product/product-brief.md` already exists, do not overwrite it. Report
the conflict to the user and ask for instructions, such as where to save the new
brief or what to do with the existing file.

After writing the file, report the saved path back to the user.
