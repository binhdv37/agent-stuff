import { defineAdapter, compatibility, issue } from '../runtime.js';
import { description, markdown, skillFiles } from '../render.js';
export const claudeCode = defineAdapter({
  id: 'claude-code', version: 4, supportedContractVersions: [4], directories: { global: '.claude', project: '.claude' },
  mappedFields: {
    skill: ['schema_version', 'kind', 'id', 'description', 'instructions', 'resources',
      'activation', 'argument_hint'],
    agent: ['schema_version', 'kind', 'id', 'description', 'instructions', 'resources', 'role', 'policy',
      'policy.workspace_read', 'policy.workspace_write', 'policy.shell', 'policy.questions',
      'policy.delegation', 'policy.delegation_targets', 'policy.write_paths'],
  },
  check(asset) {
    const d = asset.definition;
    if (d.kind === 'agent') {
      const issues = [];
      if (d.role !== 'delegated') issues.push(issue('role', 'unsupported',
        'Only delegated agents are mapped by this adapter.',
        'A primary agent will not be installed as a subagent.'));
      if (asset.resources.size) issues.push(issue('resources', 'unsupported',
        'Agent resources are not mapped yet.', 'Supporting files would be missing from this agent installation.'));
      if (d.policy.workspace_read !== 'allow') issues.push(issue('policy.workspace_read', 'unsupported',
        'The delegated-agent mapping requires workspace_read: allow.',
        'The Read/Glob/Grep tool allowlist does not preserve denied or ask-on-read access.'));
      for (const field of ['workspace_write', 'shell', 'questions', 'delegation'] as const) {
        if (d.policy[field] !== 'deny') issues.push(issue(`policy.${field}`, 'unsupported',
          `The delegated-agent mapping requires ${field}: deny.`,
          'Only Read, Glob, and Grep are exposed; the requested permission cannot be preserved.'));
      }
      if (d.policy.write_paths.length) issues.push(issue('policy.write_paths', 'unsupported',
        'Path-scoped writes are not mapped.', 'The tool allowlist excludes all file-editing tools.'));
      if (d.policy.delegation_targets.length) issues.push(issue('policy.delegation_targets', 'unsupported',
        'Delegation targets are not mapped.', 'The tool allowlist excludes delegation.'));
      return compatibility(asset, 'Native delegated agent restricted to Read, Glob, and Grep.', issues);
    }
    return compatibility(asset, 'Native skill, also available through /<skill-name>.', d.kind === 'skill' ? [] : [
      issue('workflow', 'unsupported',
        'Use the corresponding skill slash command; a duplicate command is not installed.',
        'This kind cannot be installed with its core contract; use the documented alternative explicitly.'),
    ]);
  },
  render(asset, catalog) {
    const d = asset.definition;
    if (d.kind === 'agent') return [{
      asset: asset.key,
      path: `agents/${d.id}.md`,
      content: markdown({ name: d.id, description: d.description, tools: ['Read', 'Glob', 'Grep'] }, asset.body),
    }];
    if (d.kind !== 'skill') throw new Error(`Unsupported kind: ${d.kind}`);
    return skillFiles(asset, { name: d.id, description: description(asset),
      'disable-model-invocation': d.activation === 'explicit',
      ...(d.argument_hint ? { 'argument-hint': d.argument_hint } : {}),
    });
  },
});
