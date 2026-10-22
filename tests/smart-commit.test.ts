import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { parse } from 'yaml';
import { loadCatalog } from '../core/src/index.js';
import { getAdapter } from '../adapters/index.js';

test('smart-commit stays explicit and renders without bundled helpers on every adapter', async () => {
  const catalog = await loadCatalog(path.join('.', 'core')); const skill = catalog.get('skill/bdv-smart-commit')!;
  assert.equal(skill.resources.size, 0);
  for (const id of ['codex', 'claude-code', 'opencode']) {
    const adapter = getAdapter(id), output = adapter.render(skill, catalog);
    const instructions = output.find(f => f.path.endsWith('/SKILL.md'))!.content.toString();
    assert.match(parse(instructions.split('---')[1]!).description, /Do not invoke automatically/);
    assert.ok(!output.some(f => f.path.includes('/scripts/')));
    if (id === 'codex') assert.equal(parse(output.find(f => f.path.endsWith('/openai.yaml'))!.content.toString()).policy.allow_implicit_invocation, false);
    if (id === 'claude-code') assert.equal(parse(instructions.split('---')[1]!)['disable-model-invocation'], true);
    if (id === 'opencode') assert.equal(adapter.check(skill, catalog).status, 'limited');
  }
});
