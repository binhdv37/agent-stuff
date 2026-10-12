# Format and authoring

A core root contains the skill, agent, and command catalog:

```text
core-root/
  skills/<id>/definition.yaml
  skills/<id>/instructions.md
  agents/<id>/definition.yaml
  agents/<id>/instructions.md
  commands/<id>/definition.yaml
```

The loader reads only these three catalog directories; library directories such
as `src/` and `docs/` are not definitions. All definitions require `schema_version`,
`kind`, `id`, and `description`. The current YAML format is `schema_version: 1`;
unknown fields are rejected.

The kind must match the catalog directory and the ID must match its subdirectory.
Catalog keys use `kind/id`, so different kinds may share an ID. IDs are kebab-case,
at most 64 characters. Authoring conventions use `bdv-` for skills and commands;
the validator does not require this prefix.

## Files

| File | Purpose |
|---|---|
| `definition.yaml` | Identity, descriptions, metadata, configuration, and file references |
| File referenced by `instructions` | Non-empty UTF-8 skill or agent instructions; `instructions.md` is conventional, not required as the filename |
| Files listed in `resources` | Supporting documents, templates, scripts, or other files; loaded as bytes |

Commands in v1 reference a skill through `workflow`; they have no independent
instructions or resources. The format does not define native placeholders,
model preferences, profiles, or native per-definition overrides.

## Validation

`loadCatalog` validates schema, custom constraints, references, and files;
JSON Schema alone is insufficient. See [fields](fields.md) for field semantics,
required inputs, defaults, and policy constraints.

- Instructions and resource paths are relative to the definition's directory.
  Paths must be non-empty and normalized: no absolute paths, backslashes, colons,
  NUL, or empty, `.` or `..` segments. Referenced files must exist without symlinks.
- Resources must be unique and cannot name `definition.yaml`, `SKILL.md`, or the
  instructions file. Files directly in the definition's directory are valid resources.
- Workflow and delegation references must resolve to valid catalog entries.
- `policy.write_paths` patterns are relative to the project, not the definition's
  directory.

Validation checks definitions, not execution or model behavior.

## Authoring

1. Read [concepts](concepts.md) and similar definitions. Specify inputs, outputs,
   behavior, constraints, and success criteria; prefer reuse or revision.
2. For a new skill, ask whether automatic invocation is wanted; default to
   `explicit`. Check that the existing format can express the requirements.
3. Write instructions once, declare configuration and resources in
   `definition.yaml`, and let commands reference skills instead of duplicating them.
4. Validate with `loadCatalog`; test defaults, errors, references, and constraints.

Extend the contract only for a concrete use case. Define field meaning, type,
default, conflicting combinations, enforcement requirements, errors, and format/API
impact before implementation. New kinds require schema, catalog loading, validation,
and documentation. See [API](README.md) for versioning and regenerating fields from
the schema and metadata; do not edit the generated reference by hand.

Migrations preserve instruction/resource bytes and activation preferences. If a
workflow is intentionally revised, record the reason rather than changing migration
hashes to conceal it.
