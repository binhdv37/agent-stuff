import { stringify } from 'yaml';
import type { Adapter } from '../../tool/src/adapter.js';
import { description, skillFiles } from '../../tool/src/render.js';
export const codex: Adapter = {
  id: 'codex', version: 1, directories: { global: '.agents', project: '.agents' },
  check(asset) {
    const d = asset.definition;
    return { asset: asset.key, status: d.kind === 'skill' ? 'supported' : 'unsupported',
      reason: d.kind === 'skill' ? 'Native skill with invocation policy in agents/openai.yaml.'
        : d.kind === 'command' ? 'Standalone commands are not implemented; invoke the corresponding skill explicitly.'
        : 'Primary agent roles and permissions are not mapped by this adapter.' };
  },
  render(asset, catalog) {
    const d = asset.definition;
    if (d.kind !== 'skill') throw new Error(this.check(asset, catalog).reason);
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
};
