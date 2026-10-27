import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, cp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse, stringify } from 'yaml';
import * as prompts from '@clack/prompts';
import { loadCatalog, resolveSelection, selectAssets } from '../core/src/index.js';
import { InteractiveFlow } from '../tool/src/prompts.js';
import { getAdapter } from '../adapters/index.js';

async function temporary(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'agent-stuff-companions-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('install_with validates references and resolves directed transitive cycles with origins', async t => {
  const root = await temporary(t);
  await cp('core', path.join(root, 'core'), { recursive: true });
  const file = path.join(root, 'core/skills/bdv-implement/definition.yaml');
  const definition = parse(await readFile(file, 'utf8'));
  for (const [refs, message] of [
    [['agent/missing'], /missing install_with/],
    [['skill/bdv-implement'], /cannot reference self/],
    [['agent/bdv-implementer', 'agent/bdv-implementer'], /Duplicate install_with/],
    [['invalid'], /Invalid/],
  ] as const) {
    await writeFile(file, stringify({ ...definition, install_with: refs }));
    await assert.rejects(loadCatalog(path.join(root, 'core')), message);
  }
  await writeFile(file, stringify({ ...definition, install_with: ['skill/bdv-code-review', 'agent/bdv-reviewer'] }));
  const helperFile = path.join(root, 'core/agents/bdv-reviewer/definition.yaml');
  await writeFile(helperFile, stringify({ ...parse(await readFile(helperFile, 'utf8')), install_with: ['skill/bdv-implement'] }));
  const catalog = await loadCatalog(path.join(root, 'core'));
  const selection = resolveSelection(catalog, ['skill/bdv-implement']);
  assert.deepEqual(selection.assets.map(a => a.key), ['skill/bdv-implement', 'skill/bdv-code-review', 'agent/bdv-reviewer']);
  assert.deepEqual(selection.companions, [
    { key: 'skill/bdv-code-review', from: ['skill/bdv-implement'] },
    { key: 'agent/bdv-reviewer', from: ['skill/bdv-code-review', 'skill/bdv-implement'] },
  ]);
  assert.deepEqual(selectAssets(catalog, ['skill/bdv-implement'], false).map(a => a.key), ['skill/bdv-implement']);
  const original = await loadCatalog('core');
  assert.deepEqual(selectAssets(original, ['agent/bdv-implementer']).map(a => a.key), ['agent/bdv-implementer']);
});

test('interactive companions default to included and can all be deselected', async () => {
  const catalog = await loadCatalog('core');
  const items = resolveSelection(catalog, ['skill/bdv-implement']).companions;
  const flow = new InteractiveFlow({ ...prompts,
    bar: () => ({ start() {}, stop() {}, update() {}, error() {} }),
    multiselect: (async options => {
      assert.equal(options.required, false);
      assert.deepEqual(options.initialValues, ['agent/bdv-implementer']);
      assert.match(options.options[0]!.hint!, /with skill\/bdv-implement/);
      return [];
    }) as typeof prompts.multiselect,
  });
  assert.deepEqual(await flow.companions(items, catalog, getAdapter('opencode')), []);
});

for (const scope of ['project', 'global']) {
  test(`CLI companion selection and lifecycle preserve partial choices in ${scope} scope`, async t => {
    const root = await temporary(t);
    const source = path.join(root, 'source');
    await mkdir(source);
    await cp('core', path.join(source, 'core'), { recursive: true });
    const base = ['--agent', 'opencode', '--scope', scope, '--project', root];
    const run = (command: string, ...args: string[]) => {
      const result = spawnSync(process.execPath, [path.resolve('dist/tool/src/cli.js'), command, ...base, ...args], {
        encoding: 'utf8', env: { ...process.env, HOME: root },
      });
      return { status: result.status, output: result.stdout + result.stderr };
    };
    const target = path.join(root, scope === 'project' ? '.opencode' : '.config/opencode');
    const selection = ['--source', source, '--only', 'skill/bdv-implement'];
    let result = run('install', ...selection, '--dry-run');
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /Include agent\/bdv-implementer — with skill\/bdv-implement/);
    await assert.rejects(readFile(path.join(target, 'skills/bdv-implement/SKILL.md')), { code: 'ENOENT' });
    result = run('install', ...selection, '--no-install-with', '--yes', '--accept-limitations');
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /Omit agent\/bdv-implementer/);
    await assert.rejects(readFile(path.join(target, 'agents/bdv-implementer.md')), { code: 'ENOENT' });
    const definitionFile = path.join(source, 'core/skills/bdv-implement/definition.yaml');
    const original = await readFile(definitionFile, 'utf8');
    await writeFile(definitionFile, stringify({ ...parse(original), install_with: ['agent/bdv-implementer', 'agent/bdv-reviewer'] }));
    result = run('update', '--yes', '--accept-limitations');
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /suggestions only during update/);
    await assert.rejects(readFile(path.join(target, 'agents/bdv-implementer.md')), { code: 'ENOENT' });
    await assert.rejects(readFile(path.join(target, 'agents/bdv-reviewer.md')), { code: 'ENOENT' });
    await writeFile(definitionFile, original);
    result = run('install', ...selection, '--yes', '--accept-limitations');
    assert.equal(result.status, 0, result.output);
    assert.match(await readFile(path.join(target, 'agents/bdv-implementer.md'), 'utf8'), /mode: subagent/);
    assert.equal(run('install', ...selection, '--yes', '--accept-limitations').status, 0);
    result = run('uninstall', '--only', 'skill/bdv-implement', '--yes');
    assert.equal(result.status, 0, result.output);
    assert.ok(await readFile(path.join(target, 'agents/bdv-implementer.md')));
    await writeFile(path.join(target, 'agents/bdv-implementer.md'), 'User edit\n');
    result = run('install', ...selection, '--yes', '--accept-limitations');
    assert.equal(result.status, 1);
    assert.equal(await readFile(path.join(target, 'agents/bdv-implementer.md'), 'utf8'), 'User edit\n');
  });
}

test('retired planning agents leave the catalog and are removed only by a confirmed managed update', async t => {
  const root = await temporary(t);
  const source = path.join(root, 'source');
  await cp('core', path.join(source, 'core'), { recursive: true });
  const catalog = await loadCatalog(path.join(source, 'core'));
  for (const id of ['experimental-plan', 'bdv-plan-reviewer']) {
    assert.equal(catalog.has(`agent/${id}`), false);
    const directory = path.join(source, 'core/agents', id);
    await mkdir(directory);
    await writeFile(path.join(directory, 'definition.yaml'), stringify({
      schema_version: 1, kind: 'agent', id, description: 'Synthetic retired installation fixture',
      role: 'delegated', instructions: 'instructions.txt', policy: { workspace_read: 'allow' },
    }));
    await writeFile(path.join(directory, 'instructions.txt'), 'Synthetic retired installation fixture\n');
  }
  const base = ['--agent', 'opencode', '--scope', 'project', '--project', root, '--source', source];
  const run = (command: string, ...args: string[]) => spawnSync(process.execPath,
    [path.resolve('dist/tool/src/cli.js'), command, ...base, ...args], { encoding: 'utf8' });
  assert.equal(run('install', '--only', 'agent/experimental-plan', '--only', 'agent/bdv-plan-reviewer', '--yes').status, 0);
  for (const id of ['experimental-plan', 'bdv-plan-reviewer']) {
    await rm(path.join(source, 'core/agents', id), { recursive: true });
  }
  const file = path.join(root, '.opencode/agents/experimental-plan.md');
  const original = await readFile(file, 'utf8');
  const preview = run('update', '--dry-run', '--verbose');
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /remove\s+agents\/experimental-plan.md/);
  assert.equal(await readFile(file, 'utf8'), original);
  await writeFile(file, 'User changes\n');
  assert.equal(run('update', '--yes').status, 1);
  assert.equal(await readFile(file, 'utf8'), 'User changes\n');
  await writeFile(file, original);
  assert.equal(run('update', '--yes').status, 0);
  await assert.rejects(readFile(file), { code: 'ENOENT' });
  await assert.rejects(readFile(path.join(root, '.opencode/agents/bdv-plan-reviewer.md')), { code: 'ENOENT' });
});

test('unsupported companions are visible and partial builds require an explicit choice', async t => {
  const root = await temporary(t);
  const run = (...args: string[]) => spawnSync(process.execPath, [path.resolve('dist/tool/src/cli.js'), ...args], { encoding: 'utf8' });
  for (const agent of ['codex', 'claude-code']) {
    const args = ['build', '--agent', agent, '--source', '.', '--only', 'skill/bdv-implement', '--out', path.join(root, agent), '--dry-run'];
    const blocked = run(...args);
    assert.equal(blocked.status, 1);
    assert.match(blocked.stdout + blocked.stderr, /agent\/bdv-implementer/);
    assert.match(blocked.stderr, /--no-install-with/);
    const partial = run(...args, '--no-install-with');
    assert.equal(partial.status, 0, partial.stderr);
    assert.match(partial.stdout, /Omit agent\/bdv-implementer/);
    assert.doesNotMatch(partial.stdout, /render agents\/bdv-implementer/);
    const compatible = run(...args, '--compatible-only');
    assert.equal(compatible.status, 0, compatible.stderr);
    assert.match(compatible.stdout, /Omit agent\/bdv-implementer/);
  }
});
