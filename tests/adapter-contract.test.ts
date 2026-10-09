import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, cp, mkdtemp, readFile, realpath, rm, symlink, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { getContract, loadCatalog } from '../core/src/index.js';
import { adapters, getAdapter, defineAdapter, compatibility, AdapterContractError } from '../adapters/index.js';
import { readManifest, targetContext, planUninstall } from '../tool/src/installation/index.js';

async function temporary(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'agent-stuff-adapter-contract-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('contract version and field vocabulary drift block both check and direct render', async () => {
  const catalog = await loadCatalog('core');
  const asset = catalog.get('skill/bdv-brainstorm-first')!;
  let calls = 0;
  for (const mutate of [
    (c: ReturnType<typeof getContract>) => { c.contractVersion = 99; },
    (c: ReturnType<typeof getContract>) => { c.definitionSchemaVersion = 2; },
    (c: ReturnType<typeof getContract>) => { c.kinds.skill.fields.future_behavior = { category: 'behavior', description: 'New behavior' }; },
    (c: ReturnType<typeof getContract>) => { c.kinds.skill.schema.properties!.future_behavior = { type: 'boolean' }; },
  ]) {
    const contract = getContract();
    mutate(contract);
    const adapter = defineAdapter({ id: 'codex', version: 2, supportedContractVersions: [3],
      directories: { global: '.agents', project: '.agents' }, mappedFields: {},
      check(a) { calls++; return compatibility(a, 'should not run'); },
      render() { calls++; return []; },
    }, () => contract);
    assert.throws(() => adapter.check(asset, catalog), AdapterContractError);
    const render = adapter.render;
    assert.throws(() => render(asset, catalog), /expected core contract \[3\], actual/);
  }
  assert.equal(calls, 0);
});

test('unknown definition fields and unmapped behavior cannot be silently rendered', async () => {
  const catalog = await loadCatalog('core');
  const original = catalog.get('skill/bdv-brainstorm-first')!;
  for (const adapter of adapters) {
    const asset = structuredClone(original);
    Object.assign(asset.definition, { future_behavior: true });
    const result = adapter.check(asset, catalog);
    assert.equal(result.status, 'unsupported');
    assert.equal(result.issues[0]!.field, 'future_behavior');
    assert.throws(() => adapter.render(asset, catalog), /future_behavior/);
  }
  let rendered = false;
  const adapter = defineAdapter({ id: 'codex', version: 2, supportedContractVersions: [3],
    directories: { global: '.agents', project: '.agents' },
    mappedFields: { skill: ['schema_version', 'kind', 'id', 'description', 'instructions', 'resources'] },
    check(a) { return compatibility(a, 'native output'); },
    render() { rendered = true; return []; },
  });
  assert.equal(adapter.check(original, catalog).issues.find(i => i.field === 'activation')!.status, 'unsupported');
  assert.throws(() => adapter.render(original, catalog), /activation/);
  assert.equal(rendered, false);
});

test('metadata omissions are explicit limitations and policy combinations aggregate blockers', async () => {
  const catalog = await loadCatalog('core');
  const asset = catalog.get('skill/bdv-handoff')!;
  const expected = {
    codex: ['argument_hint'],
    'claude-code': ['display_name', 'short_description'],
    opencode: ['activation', 'argument_hint', 'display_name', 'short_description'],
  };
  for (const adapter of adapters) {
    const result = adapter.check(asset, catalog);
    assert.equal(result.status, 'limited');
    assert.deepEqual(result.issues.map(i => i.field).sort(), expected[adapter.id].sort());
    assert.ok(result.issues.every(i => i.reason && i.effect && i.status === 'limited'));
    assert.ok(adapter.render(asset, catalog).length);
  }
  const agent = structuredClone(catalog.get('agent/solution-architect')!);
  if (agent.definition.kind !== 'agent') throw new Error('Expected agent');
  agent.definition.policy.shell = 'ask';
  agent.definition.policy.delegation = 'ask';
  agent.definition.resources.push('extra.md');
  agent.resources.set('extra.md', Buffer.from('supporting resource'));
  const result = getAdapter('opencode').check(agent, catalog);
  assert.equal(result.status, 'unsupported');
  assert.deepEqual(result.issues.map(i => i.field).sort(), ['policy.delegation', 'policy.shell', 'resources']);
  assert.throws(() => getAdapter('opencode').render(agent, catalog), /Cannot render/);
});

test('all native output bytes match the baseline captured before the adapter refactor', async () => {
  const catalog = await loadCatalog('core');
  const baseline = JSON.parse(await readFile('tests/fixtures/adapter-render-baseline.json', 'utf8'));
  const outputs = [];
  for (const adapter of adapters) for (const asset of catalog.values()) {
    if (adapter.check(asset, catalog).status === 'unsupported') continue;
    for (const file of adapter.render(asset, catalog)) outputs.push({ adapter: adapter.id, asset: asset.key, path: file.path,
      sha256: createHash('sha256').update(file.content).digest('hex') });
  }
  assert.deepEqual(outputs, baseline.outputs);
});

test('adapters operate independently with core and dependencies, without tool files', async t => {
  const root = await temporary(t);
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}\n');
  await cp('dist/core', path.join(root, 'core'), { recursive: true });
  await cp('dist/adapters', path.join(root, 'adapters'), { recursive: true });
  await symlink(path.resolve('node_modules'), path.join(root, 'node_modules'));
  const api = await import(pathToFileURL(path.join(root, 'adapters/index.js')).href);
  const catalog = await loadCatalog('core');
  const asset = catalog.get('skill/bdv-api-handoff')!;
  for (const adapter of api.adapters) {
    assert.deepEqual(adapter.supportedContractVersions, [3]);
    assert.notEqual(adapter.check(asset, catalog).status, 'unsupported');
    assert.ok(adapter.render(asset, catalog).length);
  }
});

test('CLI refuses limited metadata until accepted and retains legacy manifest compatibility', async t => {
  const root = await temporary(t);
  const cli = path.resolve('dist/tool/src/cli.js');
  const args = ['install', '--agent', 'codex', '--scope', 'project', '--project', root,
    '--source', path.resolve('tests/fixtures'), '--only', 'skill/bdv-handoff', '--yes'];
  assert.throws(() => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', stdio: 'pipe' }),
    (error: unknown) => {
      const e = error as { stdout: string; stderr: string };
      assert.match(e.stdout, /argument_hint \[limited\]/);
      assert.match(e.stdout, /Effect:/);
      return /accept-limitations/.test(e.stderr);
    });
  await assert.rejects(access(path.join(root, '.agents')));
  await assert.rejects(access(path.join(root, '.agent-stuff')));
  execFileSync(process.execPath, [cli, ...args, '--accept-limitations'], { stdio: 'pipe' });
  const context = await targetContext('project', root, root, 'codex');
  const manifest = (await readManifest(context))!;
  assert.equal(manifest.adapter_version, 2);
  await writeFile(context.manifest, JSON.stringify({ ...manifest, adapter_version: 1 }));
  assert.equal((await readManifest(context))!.adapter_version, 1);
  assert.ok((await planUninstall(context)).changes.every(c => c.action === 'remove'));
});

test('CLI acceptance cannot override unsupported assets or write installation files', async t => {
  const root = await temporary(t);
  assert.throws(() => execFileSync(process.execPath, [path.resolve('dist/tool/src/cli.js'),
    'install', '--agent', 'codex', '--scope', 'project', '--project', root,
    '--source', path.resolve('tests/fixtures'), '--only', 'agent/solution-architect',
    '--yes', '--accept-limitations'], { encoding: 'utf8', stdio: 'pipe' }),
  (error: unknown) => {
    const e = error as { stdout: string; stderr: string };
    assert.match(e.stdout, /unsupported: agent\/solution-architect/);
    assert.match(e.stdout, /\[unsupported\]/);
    return /Selection contains unsupported assets/.test(e.stderr);
  });
  await assert.rejects(access(path.join(root, '.agents')));
  await assert.rejects(access(path.join(root, '.agent-stuff')));
});

test('CLI contract mismatch is blocked before writes in both scopes, even with bypass flags', async t => {
  const root = await temporary(t);
  const source = path.join(root, 'source');
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  await mkdir(home); await mkdir(project);
  await cp('dist', path.join(source, 'dist'), { recursive: true });
  await cp('tests/fixtures/core', path.join(source, 'core'), { recursive: true });
  await writeFile(path.join(source, 'package.json'), '{"type":"module"}\n');
  await symlink(path.resolve('node_modules'), path.join(source, 'node_modules'));
  const file = path.join(source, 'dist/core/src/contract.js');
  const before = await readFile(file, 'utf8');
  assert.match(before, /contractVersion: 3/);
  await writeFile(file, before.replace('contractVersion: 3', 'contractVersion: 99'));
  for (const scope of ['global', 'project']) {
    assert.throws(() => execFileSync(process.execPath, [path.join(source, 'dist/tool/src/cli.js'),
      'install', '--agent', 'codex', '--scope', scope, '--project', project, '--source', source,
      '--only', 'skill/bdv-api-handoff', '--yes', '--compatible-only', '--accept-limitations'],
    { env: { ...process.env, HOME: home }, encoding: 'utf8', stdio: 'pipe' }), /expected core contract \[3\], actual 99/);
    const target = scope === 'global' ? home : project;
    await assert.rejects(access(path.join(target, '.agents')));
    await assert.rejects(access(path.join(target, '.agent-stuff')));
  }
});
