import { defineAdapter, compatibility, issue } from '../runtime.js';
import { description, skillFiles } from '../render.js';
export const claudeCode = defineAdapter({
  id: 'claude-code', version: 2, supportedContractVersions: [3], directories: { global: '.claude', project: '.claude' },
  mappedFields: { skill: ['schema_version', 'kind', 'id', 'description', 'instructions', 'resources',
    'activation', 'argument_hint'] },
  check(asset) {
    const d = asset.definition;
    return compatibility(asset, 'Native skill, also available through /<skill-name>.', d.kind === 'skill' ? [] : [
      issue(d.kind === 'agent' ? 'role' : 'workflow', 'unsupported',
        d.kind === 'command' ? 'Use the corresponding skill slash command; a duplicate command is not installed.'
          : 'Agent roles cannot be preserved by this adapter.',
        'This kind cannot be installed with its core contract; use the documented alternative explicitly.'),
    ]);
  },
  render(asset, catalog) {
    const d = asset.definition;
    if (d.kind !== 'skill') throw new Error(`Unsupported kind: ${d.kind}`);
    return skillFiles(asset, { name: d.id, description: description(asset),
      'disable-model-invocation': d.activation === 'explicit',
      ...(d.argument_hint ? { 'argument-hint': d.argument_hint } : {}),
    });
  },
});
