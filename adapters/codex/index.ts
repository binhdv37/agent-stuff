import { stringify } from 'yaml';
import { defineAdapter, compatibility, issue } from '../runtime.js';
import { description, skillFiles } from '../render.js';
export const codex = defineAdapter({
  id: 'codex', version: 2, supportedContractVersions: [3], directories: { global: '.agents', project: '.agents' },
  mappedFields: { skill: ['schema_version', 'kind', 'id', 'description', 'instructions', 'resources',
    'activation', 'display_name', 'short_description'] },
  check(asset) {
    const d = asset.definition;
    return compatibility(asset, 'Native skill with invocation policy in agents/openai.yaml.', d.kind === 'skill' ? [] : [
      issue(d.kind === 'agent' ? 'role' : 'workflow', 'unsupported',
        d.kind === 'command' ? 'Standalone commands are not implemented; invoke the corresponding skill explicitly.'
          : 'Agent roles and permissions are not mapped by this adapter.',
        'This kind cannot be installed with its core contract; use the documented alternative explicitly.'),
    ]);
  },
  render(asset, catalog) {
    const d = asset.definition;
    if (d.kind !== 'skill') throw new Error(`Unsupported kind: ${d.kind}`);
    const config: Record<string, unknown> = { policy: { allow_implicit_invocation: d.activation === 'matching-request' } };
    if (d.display_name || d.short_description) config.interface = {
      ...(d.display_name ? { display_name: d.display_name } : {}),
      ...(d.short_description ? { short_description: d.short_description } : {}),
    };
    return [...skillFiles(asset, { name: d.id, description: description(asset) }), {
      asset: asset.key, path: `skills/${d.id}/agents/openai.yaml`,
      content: Buffer.from(stringify(config, { defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' })),
    }];
  },
});
