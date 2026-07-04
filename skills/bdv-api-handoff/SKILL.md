---
name: bdv-api-handoff
description: Use ONLY when the user explicitly asks for it — e.g. "document this API", "hand off this endpoint", "prepare FE integration notes", or similar direct requests. Do NOT trigger automatically when documenting or summarizing code — wait for the user to ask.
---

# API Handoff

Use this skill to prepare Markdown documentation that helps frontend engineers
integrate an API without reading backend code.

## Workflow

1. Inspect the actual implementation before writing docs. Start from routes,
   handlers/controllers, validators, serializers/mappers, services,
   permission checks, constants/enums, tests, fixtures, and sample responses.
2. Treat backend code behavior as the source of truth. Existing OpenAPI,
   Swagger, Postman, or docs may be useful secondary context, but do not treat
   them as authoritative over code.
3. Identify the request contract, response shape, errors, auth requirements,
   and FE-relevant behavior.
4. Find constants and enums used in request or response fields. Document every
   possible value and explain what each value means for FE rendering,
   branching, filtering, permissions, labels, icons, or disabled states.
5. Detect response variants. If different cases produce different values,
   shapes, nullable fields, or meanings, document each case separately with a
   concise example.
6. If a field meaning is unclear after inspecting code, tests, fixtures, and
   existing docs, ask the human for clarification before finalizing. Use a
   question/request tool when available; otherwise ask concise direct
   questions.
7. Write the handoff using `references/handoff-template.md` unless the user
   asks for a different shape.

## Output Rules

- Keep the doc concise and precise. Include only information FE needs to call
  the API and map the response into UI.
- Explain field semantics, not backend implementation internals.
- Include nullable and optional fields only when they affect FE rendering,
  branching, or state handling.
- Include pagination, sorting, filtering, date/time format, money/unit format,
  URL expiry, and permission-dependent visibility only when present.
- Use real examples from tests, fixtures, serializers, or branch logic first.
  If examples must be synthesized, keep them realistic and omit irrelevant
  fields.
- Do not include generic review sections such as validation logs, test command
  output, database internals, or broad implementation walkthroughs.

## Clarification Policy

Ask before finalizing when:

- A field name is too generic to infer safely, such as `type`, `status`,
  `source`, `mode`, `scope`, `level`, or `flag`.
- An enum value is discoverable but its product meaning is not.
- A response variant has different UI meaning that is not clear from code.
- A nullable or optional field may affect FE behavior but the reason is unclear.
- Existing docs and code conflict in a way that affects FE integration.

Do not guess these details. Document confirmed details and ask for the missing
semantics needed to make the handoff useful.
