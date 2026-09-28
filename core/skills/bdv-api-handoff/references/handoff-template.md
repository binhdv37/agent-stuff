# API Handoff Template

Use this shape for frontend-facing API handoff docs. Omit sections that do not
apply. Keep each section short.

````md
# <API name or endpoint purpose>

## Purpose
<One or two sentences describing what FE can use this API for.>

## Endpoint
- Method: `<HTTP_METHOD>`
- Path: `<PATH>`
- Auth: <required auth, role, permission, or "None">

## Request
### Path Params
| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `<field>` | `<type>` | Yes/No | <FE-relevant meaning> |

### Query Params
| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `<field>` | `<type>` | Yes/No | <FE-relevant meaning> |

### Body
| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `<field>` | `<type>` | Yes/No | <FE-relevant meaning> |

## Response
| Field | Type | Meaning |
| --- | --- | --- |
| `<field>` | `<type>` | <FE-relevant meaning> |

## Enum And Constant Values
| Field | Value | Meaning For FE |
| --- | --- | --- |
| `<field>` | `<VALUE>` | <label, UI behavior, or product meaning> |

## Response Variants
### `<case name or discriminator=value>`
<Explain when this case appears and what it means for FE.>

```json
{
  "example": "Use a concise representative response for this case"
}
```

## Success Example
```http
<METHOD> <PATH>
```

```json
{
  "example": "request body if applicable"
}
```

```json
{
  "example": "response body"
}
```

## Errors FE Should Handle
| Status | When It Happens | FE Handling |
| --- | --- | --- |
| `400` | <condition> | <message/state/action> |

## FE Notes
- <Concise note about labels, branching, empty state, loading state, disabled
  state, formatting, or permission-specific UI behavior.>
````

If a field meaning or enum value is unclear, ask for clarification before
finalizing instead of adding an "open questions" section to the handoff.
