import type { Adapter } from '../../tool/src/adapter.js';
import { description, skillFiles } from '../../tool/src/render.js';
export const claudeCode: Adapter = {
  id: 'claude-code', version: 1, directories: { global: '.claude', project: '.claude' },
  check(asset) {
    const d = asset.definition;
    return { asset: asset.key, status: d.kind === 'skill' ? 'supported' : 'unsupported',
      reason: d.kind === 'skill' ? 'Native skill, also available through /<skill-name>.'
        : d.kind === 'command' ? 'Use the corresponding skill slash command; a duplicate command is not installed.'
        : 'Primary agent roles cannot be preserved by this adapter.' };
  },
  render(asset, catalog) {
    const d = asset.definition;
    if (d.kind !== 'skill') throw new Error(this.check(asset, catalog).reason);
    return skillFiles(asset, { name: d.id, description: description(asset),
      'disable-model-invocation': d.activation === 'explicit',
      ...(d.argument_hint ? { 'argument-hint': d.argument_hint } : {}),
    });
  },
};
