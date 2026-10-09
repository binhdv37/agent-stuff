import type { Compatibility, OutputFile } from '../types.js';
import { defineAdapter, compatibility, issue } from '../runtime.js';

import { description, markdown } from '../render.js';

export const opencode = defineAdapter({
  id: 'opencode', version: 2, supportedContractVersions: [3], directories: { global: '.config/opencode', project: '.opencode' },
  mappedFields: {
    skill: ['schema_version', 'kind', 'id', 'description', 'instructions', 'resources', 'activation'],
    command: ['schema_version', 'kind', 'id', 'description', 'workflow'],
    agent: ['schema_version', 'kind', 'id', 'description', 'instructions', 'resources', 'role', 'policy',
      'policy.workspace_read', 'policy.workspace_write', 'policy.shell', 'policy.questions',
      'policy.delegation', 'policy.delegation_targets', 'policy.write_paths'],
  },
  check(asset, catalog): Compatibility {
    const d = asset.definition;
    const issues = [];
    if (d.kind === 'agent') {
      if (asset.resources.size) issues.push(issue('resources', 'unsupported', 'Agent resources are not mapped yet.', 'Supporting files would be missing from this agent installation.'));
      if (d.policy.workspace_write !== 'allow' && d.policy.shell !== 'deny') {
        issues.push(issue('policy.shell', 'unsupported', 'Restricted writes require shell access to be denied.', 'Shell access could bypass workspace_write/write_paths restrictions.'));
      }
      if (d.policy.delegation !== 'deny' && d.policy.delegation !== 'allow') issues.push(issue('policy.delegation', 'unsupported', 'Ask-on-delegation has no restricted target mapping.', 'The requested delegation permission cannot be preserved.'));
      if (d.policy.delegation === 'allow' && !d.policy.delegation_targets.length) issues.push(issue('policy.delegation_targets', 'unsupported', 'Delegation requires explicit read-only targets.', 'An unrestricted delegation permission would violate the core contract.'));
      for (const key of d.policy.delegation_targets) {
        const target = catalog.get(key);
        if (!target || target.definition.kind !== 'agent' || target.definition.role !== 'delegated' ||
            target.definition.policy.workspace_write !== 'deny' || target.definition.policy.write_paths.length ||
            target.definition.policy.shell !== 'deny' || target.definition.policy.delegation !== 'deny') {
          issues.push(issue('policy.delegation_targets', 'unsupported', `Delegate ${key} must be a read-only agent without shell or delegation.`, 'Unsafe or missing helper targets block rendering.'));
        }
      }
      return compatibility(asset, 'Native role and deny-by-default tool permissions.', issues);
    }
    if (d.kind === 'command') {
      const workflow = catalog.get(d.workflow);
      if (!workflow) issues.push(issue('workflow', 'unsupported', `Missing workflow: ${d.workflow}`, 'The command has no authoritative workflow to render.'));
      else {
        if (workflow.resources.size) issues.push(issue('workflow.resources', 'unsupported', 'Commands referencing workflows with resources are not supported in this increment.', 'The inline command does not preserve supporting workflow files.'));
        if (/!`|\$ARGUMENTS|\$[1-9]/.test(workflow.body)) issues.push(issue('workflow.instructions', 'unsupported', 'Workflow contains native command interpolation syntax.', 'The command could interpret workflow text as native interpolation.'));
      }
      return compatibility(asset, 'Native command with inline workflow and free-form arguments.', issues);
    }
    if (description(asset).length > 1024) issues.push(issue('description', 'unsupported', 'Rendered skill description exceeds 1024 characters.', 'The generated description violates the adapter native format baseline.'));
    if (d.activation === 'explicit') issues.push(issue('activation', 'limited', 'Explicit invocation is a textual instruction in this adapter.', 'The model may still select the skill automatically; no native invocation enforcement is installed.'));
    return compatibility(asset, 'Native skill discovery.', issues);
  },
  render(asset, catalog): OutputFile[] {
    const d = asset.definition;
    if (d.kind === 'skill') {
      return [
        { asset: asset.key, path: `skills/${d.id}/SKILL.md`, content: markdown({ name: d.id, description: description(asset) }, asset.body) },
        ...[...asset.resources].map(([resource, content]) => ({ asset: asset.key, path: `skills/${d.id}/${resource}`, content })),
      ];
    }
    if (d.kind === 'command') {
      const workflow = catalog.get(d.workflow)!;
      const wrapper = `The user explicitly requested this workflow. Treat the following arguments as its target or scope. If empty, follow the workflow's missing-input instructions.\n\nArguments: $ARGUMENTS\n\n`;
      return [{ asset: asset.key, path: `commands/${d.id}.md`, content: markdown({ description: d.description }, wrapper + workflow.body) }];
    }
    if (d.kind === 'agent') {
      const edit = d.policy.write_paths.length
        ? { '*': d.policy.workspace_write, ...Object.fromEntries(d.policy.write_paths.map(item => [item, 'allow'])) }
        : d.policy.workspace_write;
      const task = d.policy.delegation_targets.length
        ? { '*': 'deny', ...Object.fromEntries(d.policy.delegation_targets.map(key => [key.slice('agent/'.length), 'allow'])) }
        : d.policy.delegation;
      return [{ asset: asset.key, path: `agents/${d.id}.md`, content: markdown({
        description: d.description, mode: d.role === 'primary' ? 'primary' : 'subagent',
        permission: { '*': 'deny', read: d.policy.workspace_read, glob: d.policy.workspace_read,
          grep: d.policy.workspace_read, list: d.policy.workspace_read,
          edit, bash: d.policy.shell,
          question: d.policy.questions, task, external_directory: 'deny' },
      }, asset.body) }];
    }
    throw new Error(`Unsupported asset: ${asset.key}`);
  },
});
