import { z } from 'zod';

export const relativePath = z.string().min(1).refine(value =>
  !value.includes('\\') && !value.includes(':') && !value.includes('\0') &&
  !value.startsWith('/') && value.split('/').every(p => p !== '' && p !== '.' && p !== '..'),
  'Expected a normalized relative path inside the asset');
export type FieldCategory = 'structure' | 'metadata' | 'content' | 'behavior' | 'enforcement';
export type FieldMeaning = { category: FieldCategory; description: string };

// Attach semantics after optional/default/refinement wrappers so JSON export retains them.
const field = <T extends z.ZodType>(validator: T, category: FieldCategory, description: string): T =>
  validator.meta({ description, 'x-core-category': category });

const id = z.string().max(64).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const common = {
  schema_version: field(z.literal(1), 'structure', 'definition.yaml format version; only 1 is accepted.'),
  id: field(id, 'structure', 'Kebab-case ID, at most 64 characters, matching the directory name. Catalog key: kind/id.'),
  description: field(z.string().min(1).max(1024), 'content', 'Purpose and usage context; may affect discovery, so not display-only metadata. 1–1024 characters.'),
  display_name: field(z.string().min(1).optional(), 'metadata', 'Display label; does not replace the ID or control activation.'),
  short_description: field(z.string().min(1).optional(), 'metadata', 'Short display summary; does not replace description or behavioral requirements.'),
};
const content = {
  instructions: field(relativePath, 'content', 'Relative path to non-empty UTF-8 instructions; instructions.md is conventional, not required as the filename. Instructions do not replace permissions.'),
  resources: field(z.array(relativePath).default([]).refine(a => new Set(a).size === a.length, 'Duplicate resources'), 'content', 'Supporting file paths relative to the definition directory; preserve bytes. No duplicates or reserved names: definition.yaml, SKILL.md, or the instructions file.'),
};
const decision = z.enum(['allow', 'ask', 'deny']);
export const definitionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...common, ...content,
    kind: field(z.literal('skill'), 'structure', 'Definition kind; must match its catalog directory.'),
    activation: field(z.enum(['explicit', 'matching-request']).default('explicit'), 'behavior', 'explicit: the user explicitly requests the workflow or names the skill. matching-request: the model may select it for a matching request; automatic invocation is not guaranteed.'),
    argument_hint: field(z.string().optional(), 'metadata', 'User-facing input hint; not a parser, default value, or native placeholder syntax.'),
  }),
  z.strictObject({ ...common, ...content,
    kind: field(z.literal('agent'), 'structure', 'Definition kind; must match its catalog directory.'),
    role: field(z.enum(['primary', 'delegated']), 'behavior', 'primary: assistant the user works with directly. delegated: helper invoked by another agent. The declared role must be preserved.'),
    policy: field(z.strictObject({
      workspace_read: field(decision.default('deny'), 'enforcement', 'Permission to read and search workspace content.'),
      workspace_write: field(decision.default('deny'), 'enforcement', 'Default workspace write permission; write_paths declares allow exceptions.'),
      shell: field(decision.default('deny'), 'enforcement', 'Permission to run shell commands; must not bypass write restrictions.'),
      questions: field(decision.default('deny'), 'enforcement', 'Permission to use the user-question mechanism.'),
      delegation: field(decision.default('deny'), 'enforcement', 'Permission to invoke helpers; allow requires explicit delegation_targets.'),
      delegation_targets: field(z.array(z.string().regex(/^agent\/[a-z0-9]+(-[a-z0-9]+)*$/)).default([]), 'enforcement', 'Allowed agent/id references. Each target must exist, be delegated, deny workspace writes, shell, and delegation, and have no write_paths.'),
      write_paths: field(z.array(relativePath).default([]), 'enforcement', 'Project-relative allow-exception patterns for workspace_write. Must stay within the project, retain their scope, and be empty when workspace_write is allow.'),
    }), 'enforcement', 'Execution permissions, separate from instructions. allow permits an action; ask requires prior approval; deny forbids it. Omitted permission decisions default to deny; policy itself is required.'),
  }),
  z.strictObject({ ...common,
    kind: field(z.literal('command'), 'structure', 'Definition kind; must match its catalog directory.'),
    workflow: field(z.string().regex(/^skill\/[a-z0-9]+(-[a-z0-9]+)*$/), 'behavior', 'Existing skill/id reference for a user-invoked workflow; schema v1 has no standalone command template.'),
    argument_hint: field(z.string().optional(), 'metadata', 'User-facing input hint; not a parser, default value, or native placeholder syntax.'),
  }),
]);
export type Definition = z.infer<typeof definitionSchema>;
export type Asset = { key: string; definition: Definition; body: string; resources: Map<string, Buffer> };
