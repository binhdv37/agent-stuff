import type { Adapter, Compatibility, OutputFile } from '../../tool/src/adapter.js';

import { description, markdown } from '../../tool/src/render.js';

export const opencode: Adapter = {
  id: 'opencode', version: 1, directories: { global: '.config/opencode', project: '.opencode' },
  check(asset, catalog): Compatibility {
    const d = asset.definition;
    const result = (status: Compatibility['status'], reason: string): Compatibility => ({ asset: asset.key, status, reason });
    if (d.kind === 'agent') {
      if (asset.resources.size) return result('unsupported', 'Agent resources are not mapped yet.');
      if (d.policy.write_paths.length) return result('unsupported', 'Scoped writes need project-aware permission mapping and are not supported yet.');
      if (d.policy.workspace_write !== 'allow' && (d.policy.shell !== 'deny' || d.policy.delegation !== 'deny')) {
        return result('unsupported', 'Restricted writes require shell and delegation to be denied to prevent alternate write paths.');
      }
      return result('supported', 'Native role and deny-by-default tool permissions.');
    }
    if (d.kind === 'command') {
      const workflow = catalog.get(d.workflow);
      if (!workflow) return result('unsupported', `Missing workflow: ${d.workflow}`);
      if (workflow.resources.size) return result('unsupported', 'Commands referencing workflows with resources are not supported in this increment.');
      if (/!`|\$ARGUMENTS|\$[1-9]/.test(workflow.body)) return result('unsupported', 'Workflow contains native command interpolation syntax.');
      return result('supported', 'Native command with inline workflow and free-form arguments.');
    }
    if (description(asset).length > 1024) return result('unsupported', 'Rendered skill description exceeds 1024 characters.');
    return d.activation === 'explicit'
      ? result('limited', 'Explicit invocation is a textual instruction; OpenCode ignores disable-model-invocation. No permission config is modified.')
      : result('supported', 'Native skill discovery.');
  },
  render(asset, catalog): OutputFile[] {
    if (this.check(asset, catalog).status === 'unsupported') throw new Error(`Cannot render ${asset.key}: ${this.check(asset, catalog).reason}`);
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
      return [{ asset: asset.key, path: `agents/${d.id}.md`, content: markdown({
        description: d.description, mode: d.role === 'primary' ? 'primary' : 'subagent',
        permission: { '*': 'deny', read: d.policy.workspace_read, glob: d.policy.workspace_read,
          grep: d.policy.workspace_read, list: d.policy.workspace_read,
          edit: d.policy.workspace_write, bash: d.policy.shell,
          question: d.policy.questions, task: d.policy.delegation, external_directory: 'deny' },
      }, asset.body) }];
    }
    throw new Error(`Unsupported asset: ${asset.key}`);
  },
};
