import { z } from 'zod';

export const relativePath = z.string().min(1).refine(value =>
  !value.includes('\\') && !value.includes(':') && !value.includes('\0') &&
  !value.startsWith('/') && value.split('/').every(p => p !== '' && p !== '.' && p !== '..'),
  'Expected a normalized relative path inside the asset');
const id = z.string().max(64).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const common = {
  schema_version: z.literal(1), id, description: z.string().min(1).max(1024),
  display_name: z.string().min(1).optional(), short_description: z.string().min(1).optional(),
};
const content = {
  instructions: relativePath,
  resources: z.array(relativePath).default([]).refine(a => new Set(a).size === a.length, 'Duplicate resources'),
};
const decision = z.enum(['allow', 'ask', 'deny']);
export const definitionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...common, ...content, kind: z.literal('skill'),
    activation: z.enum(['explicit', 'matching-request']).default('explicit'),
    argument_hint: z.string().optional(),
  }),
  z.strictObject({ ...common, ...content, kind: z.literal('agent'),
    role: z.enum(['primary', 'delegated']),
    policy: z.strictObject({
      workspace_read: decision.default('deny'), workspace_write: decision.default('deny'),
      shell: decision.default('deny'), questions: decision.default('deny'),
      delegation: decision.default('deny'),
      write_paths: z.array(relativePath).default([]),
    }),
  }),
  z.strictObject({ ...common, kind: z.literal('command'),
    workflow: z.string().regex(/^skill\/[a-z0-9]+(-[a-z0-9]+)*$/),
    argument_hint: z.string().optional(),
  }),
]);
export type Definition = z.infer<typeof definitionSchema>;
export type Asset = { key: string; definition: Definition; body: string; resources: Map<string, Buffer> };
