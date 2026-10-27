import { z } from 'zod';
import { definitionSchema, type FieldCategory, type FieldMeaning } from './schema.js';
export type { FieldCategory, FieldMeaning } from './schema.js';

export type StuffKind = 'skill' | 'agent' | 'command';
/** JSON Schema snapshot; unknown keywords remain available without exposing Zod types. */
export type CoreSchema = {
  [keyword: string]: unknown;
  properties?: Record<string, CoreSchema>;
  required?: string[];
  default?: unknown;
  additionalProperties?: boolean;
};
export type KindContract = {
  schema: CoreSchema;
  fields: Record<string, FieldMeaning>;
};
export type CoreContract = {
  contractVersion: number;
  definitionSchemaVersion: number;
  kinds: Record<StuffKind, KindContract>;
  rules: string[];
};

const rules = [
  'JSON Schema draft 2020-12 describes YAML input; required fields, defaults, types, and enums come from the validators. Unknown definition and policy fields are rejected.',
  'loadCatalog performs full validation, including custom constraints, files, and catalog references that JSON Schema alone cannot check.',
  'install_with references must exist, be unique, and not reference self. Selection expands directed companions transitively with cycle deduplication; users may omit companions. Delegation permissions do not expand installation selection.',
  'Relative paths must be non-empty and normalized: no absolute paths, backslashes, colons, NUL, or empty, dot, or dot-dot segments. Instructions and resources must exist without symlinks.',
  'Resources must be unique, instructions non-empty, kind/id consistent with directories, and the catalog non-empty. Workflow and delegation references must resolve to the correct kinds.',
  'Non-empty write_paths cannot accompany workspace_write: allow. delegation_targets must be empty unless delegation is allow; allow requires at least one delegated target with workspace_write, shell, and delegation denied and no write_paths.',
  'Execution policies require enforcement. Shell access that bypasses write restrictions cannot satisfy the policy; enforcement feasibility is outside YAML validation.',
  'Categories describe meaning: structure is format/identity; metadata is display-only; content is instructions/descriptions/resources; behavior controls use; enforcement requires permissions. A category alone does not permit dropping a field.',
  'Unrecognized behavioral fields or unpreserved mandatory content/permissions block use. Other interpretation limits, including display-only metadata omissions, must be disclosed. Prompt instructions cannot replace permissions.',
  'Contract version is independent of YAML schema_version. Public API, schema, default, meaning, or constraint changes require a contract version increment; wording-only changes do not. Interpreting definitions requires declared version support; unsupported versions must be rejected.',
];

function fieldMeanings(schema: CoreSchema, prefix = ''): Record<string, FieldMeaning> {
  const fields: Record<string, FieldMeaning> = {};
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    const key = prefix + name;
    const category = property['x-core-category'] as FieldCategory | undefined;
    if (typeof property.description !== 'string' || !category ||
        !['structure', 'metadata', 'content', 'behavior', 'enforcement'].includes(category)) {
      throw new Error(`Missing core field metadata: ${key}`);
    }
    fields[key] = { category, description: property.description };
    Object.assign(fields, fieldMeanings(property, `${key}.`));
  }
  return fields;
}

/** Fresh, JSON-serializable snapshot. Consumers cannot mutate the next result. */
export function getContract(): CoreContract {
  const kinds = {} as Record<StuffKind, KindContract>;
  for (const schema of definitionSchema.options) {
    const kind = schema.shape.kind.value;
    const jsonSchema = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as CoreSchema;
    kinds[kind] = {
      schema: jsonSchema,
      fields: fieldMeanings(jsonSchema),
    };
  }
  return { contractVersion: 4, definitionSchemaVersion: 1, kinds, rules: [...rules] };
}
