import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, realpath, rm, cp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { loadCore } from '../tool/src/core/load.js';
import { hash } from '../tool/src/installation/index.js';
import { getAdapter } from '../tool/src/registry.js';

test('migration preserves baseline content except documented core revisions', async () => {
  const catalog = await loadCore('.');
  assert.equal(catalog.size, 16);
  const inventory = JSON.parse(await readFile('tests/fixtures/migration-inventory.json', 'utf8')) as { key: string; activation: string; hashes: Record<string, string> }[];
  assert.equal(inventory.length, 11);
  assert.equal(inventory.filter(a => a.activation === 'explicit').length, 9);
  const revisions = JSON.parse(await readFile('tests/fixtures/content-revisions.json', 'utf8')) as
    { key: string; reason: string; activation: string; hashes: Record<string, string> }[];
  assert.equal(new Set(revisions.map(r => r.key)).size, revisions.length);
  for (const revision of revisions) {
    assert.ok(inventory.some(a => a.key === revision.key));
    assert.ok(revision.reason.trim().length > 0);
  }
  for (const baseline of inventory) {
    const expected = revisions.find(r => r.key === baseline.key) ?? baseline;
    const asset = catalog.get(expected.key)!;
    assert.equal(asset.definition.kind, 'skill');
    if (asset.definition.kind !== 'skill') throw new Error('Expected skill');
    assert.equal(asset.definition.activation, expected.activation);
    assert.equal(hash(asset.body), expected.hashes['instructions.md']);
    for (const [resource, content] of asset.resources) assert.equal(hash(content), expected.hashes[resource]);
    assert.equal(asset.resources.size + 1, Object.keys(expected.hashes).length);
  }
  for (const id of ['codex', 'claude-code', 'opencode']) {
    const adapter = getAdapter(id);
    const skills = [...catalog.values()].filter(a => a.definition.kind === 'skill');
    assert.equal(skills.filter(a => adapter.check(a, catalog).status !== 'unsupported').length, 11);
  }
});

test('CLI updates installed selection and uninstalls without requiring its source', async t => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'agent-stuff-cli-lifecycle-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'source');
  await cp('tests/fixtures', source, { recursive: true });
  const cli = path.resolve('dist/tool/src/cli.js');
  const target = ['--agent', 'codex', '--scope', 'project', '--project', dir];
  const run = (...args: string[]) => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  run('install', ...target, '--source', source, '--only', 'skill/bdv-api-handoff', '--yes');
  const instructions = path.join(source, 'core/skills/bdv-api-handoff/instructions.md');
  await writeFile(instructions, 'Updated workflow\n');
  assert.match(run('update', ...target, '--dry-run'), /update .*SKILL.md/);
  run('update', ...target, '--yes');
  assert.match(await readFile(path.join(dir, '.agents/skills/bdv-api-handoff/SKILL.md'), 'utf8'), /Updated workflow/);
  await rm(source, { recursive: true });
  run('uninstall', ...target, '--yes');
  await assert.rejects(readFile(path.join(dir, '.agents/skills/bdv-api-handoff/SKILL.md')), { code: 'ENOENT' });
});
