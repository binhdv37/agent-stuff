import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, readdir, readlink, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadCatalog } from '../core/src/index.js';
import { getAdapter, adapterIds } from '../adapters/index.js';
import { assetSummary, catalogItems, formatList } from '../tool/src/prompts.js';
import { applyInstall, inspectInstallation, planInstall, readManifest, targetContext } from '../tool/src/installation/index.js';

const cli = path.resolve('dist/tool/src/cli.js');

async function temporary(t: { after(fn: () => Promise<void>): void }): Promise<string> {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'agent-stuff-inspection-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

function run(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, HOME: dir, NO_COLOR: '1' } });
}

async function snapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      const relative = path.relative(root, file);
      if (entry.isSymbolicLink()) result[relative] = `symlink:${await readlink(file)}`;
      else if (entry.isDirectory()) { result[relative] = 'directory'; await walk(file); }
      else result[relative] = (await readFile(file)).toString('base64');
    }
  }
  await walk(root);
  return result;
}

const output = (id: string, content = id) => ({
  asset: `skill/${id}`, path: `skills/${id}/SKILL.md`, content: Buffer.from(content),
});

test('list summaries reuse short descriptions and omit activation without changing core content', async () => {
  const catalog = await loadCatalog('core');
  assert.equal(assetSummary(catalog.get('skill/bdv-handoff')!), 'Compact a conversation into a handoff');
  const api = catalog.get('skill/bdv-api-handoff')!;
  assert.match(assetSummary(api), /e\.g\. "document this API"/);
  const before = api.definition.description;
  for (const asset of catalog.values()) {
    assert.ok(assetSummary(asset));
    assert.doesNotMatch(assetSummary(asset), /Do not invoke automatically|Use this skill only|Invoke explicitly as/);
    assert.doesNotMatch(assetSummary(asset), /\n/);
  }
  assert.equal(api.definition.description, before);
});

test('list groups items, preserves support labels, and keeps one bounded line per item', async () => {
  const catalog = await loadCatalog('core');
  for (const id of adapterIds) {
    const items = catalogItems(catalog, getAdapter(id));
    for (const width of [1, 36, 60, 100, 160]) {
      const formatted = formatList(items, width);
      assert.ok(formatted.split('\n').every(line => line.length <= width));
      assert.equal(formatted.split('\n').filter(Boolean).length, catalog.size + 3);
      assert.doesNotMatch(formatted, /\u001b\[/);
      if (width === 160) {
        assert.ok(formatted.indexOf('Skills') < formatted.indexOf('Commands'));
        assert.ok(formatted.indexOf('Commands') < formatted.indexOf('Agents'));
        for (const item of items) {
          const row = formatted.split('\n').find(line => line.includes(item.key))!;
          assert.ok(row, item.key);
          assert.ok(row.includes({ supported: 'Supported', limited: 'Limited', unsupported: 'Not supported' }[item.compatibility!.status]));
        }
      }
    }
  }
});

test('list JSON includes complete descriptions and compatibility, and rejects invalid harnesses', async t => {
  const dir = await temporary(t);
  const source = path.resolve('.');
  const catalog = await loadCatalog('core');
  for (const agent of [undefined, ...adapterIds]) {
    const result = run(dir, 'list', '--source', source, '--json', ...(agent ? ['--agent', agent] : []));
    assert.equal(result.status, 0, result.stderr);
    const json = JSON.parse(result.stdout);
    assert.equal(json.schema_version, 1);
    assert.equal(json.agent, agent ?? null);
    assert.equal(json.items.length, catalog.size);
    for (const item of json.items) {
      const asset = catalog.get(item.key)!;
      assert.equal(item.description, asset.definition.description);
      assert.equal(item.summary, assetSummary(asset));
      assert.deepEqual(item.compatibility, agent ? getAdapter(agent).check(asset, catalog) : null);
    }
  }
  const rejected = run(dir, 'list', '--source', source, '--agent', 'invalid');
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Unknown --agent value/);
  assert.equal(rejected.stdout, '');
  assert.deepEqual(await readdir(dir), []);
});

test('status needs no prompts, defaults to all tools/both scopes, and creates no state', async t => {
  const dir = await temporary(t);
  const result = run(dir, 'status', '--json');
  assert.equal(result.status, 0, result.stderr);
  const installations = JSON.parse(result.stdout).installations;
  assert.equal(installations.length, 6);
  for (const scope of ['project', 'global']) {
    for (const agent of adapterIds) {
      const item = installations.find((item: { scope: string; agent: string }) => item.scope === scope && item.agent === agent);
      assert.equal(item.installed, false);
      assert.equal(item.source, null);
      assert.deepEqual(item.files, []);
      assert.deepEqual(item.assets, []);
      assert.ok(item.manifest.includes(`/installations/${scope}/`));
    }
  }
  const text = run(dir, 'status');
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /No managed installation found/);
  assert.doesNotMatch(text.stdout, /\u001b\[/);
  assert.deepEqual(await readdir(dir), []);
});

test('status reports modified/missing tracked files without source, preserving files, locks, and journals', async t => {
  const dir = await temporary(t);
  const project = path.join(dir, 'project');
  await mkdir(project);
  const source = path.join(dir, 'removed-source');
  const projectContext = await targetContext('project', project, dir, 'codex');
  const globalContext = await targetContext('global', project, dir, 'codex');
  await applyInstall(await planInstall(projectContext, [output('clean'), output('edited'), output('missing')], source));
  await applyInstall(await planInstall(globalContext, [output('global')], source));
  await writeFile(path.join(projectContext.target, output('edited').path), 'local edits');
  await rm(path.join(projectContext.target, output('missing').path));
  await writeFile(path.join(projectContext.target, 'untracked.txt'), 'unrelated');
  await writeFile(`${projectContext.manifest}.journal`, 'preserve recovery journal');
  await writeFile(`${projectContext.manifest}.lock`, 'preserve lock');
  const before = await snapshot(dir);
  const flags = ['--agent', 'codex', '--project', project];
  const result = run(dir, 'status', ...flags, '--json');
  assert.equal(result.status, 0, result.stderr);
  const installations = JSON.parse(result.stdout).installations;
  assert.equal(installations.length, 2);
  const installed = installations.find((item: { scope: string }) => item.scope === 'project');
  assert.equal(installed.source, source);
  assert.deepEqual(installed.assets, ['skill/clean', 'skill/edited', 'skill/missing']);
  assert.deepEqual(installed.files.map((file: { status: string }) => file.status), ['unchanged', 'modified', 'missing']);
  for (const verbose of [false, true]) {
    const text = run(dir, 'status', ...flags, '--scope', 'project', ...(verbose ? ['--verbose'] : []));
    assert.equal(text.status, 0, text.stderr);
    assert.match(text.stdout, /Files: 1 unchanged · 1 modified · 1 missing/);
    assert.match(text.stdout, /modified  skills\/edited\/SKILL.md/);
    assert.match(text.stdout, /missing  skills\/missing\/SKILL.md/);
    assert.equal(text.stdout.includes('unchanged  skills/clean/SKILL.md'), verbose);
    assert.ok(!text.stdout.includes('untracked.txt'));
  }
  const global = run(dir, 'status', ...flags, '--scope', 'global', '--json');
  assert.equal(global.status, 0, global.stderr);
  assert.equal(JSON.parse(global.stdout).installations[0].files[0].asset, 'skill/global');
  assert.deepEqual(await snapshot(dir), before);
});

test('status reports empty manifests and legacy revisions, and reports invalid state without treating it as absent', async t => {
  const dir = await temporary(t);
  const context = await targetContext('project', dir, dir, 'codex');
  await applyInstall(await planInstall(context, [output('example')], 'nonexistent-source'));
  const manifest = (await readManifest(context))!;
  await writeFile(context.manifest, JSON.stringify({ ...manifest, adapter_version: 1 }));
  assert.equal((await inspectInstallation(context)).adapter_version, 1);
  await writeFile(context.manifest, JSON.stringify({ ...manifest, files: [] }));
  const empty = run(dir, 'status', '--agent', 'codex', '--scope', 'project', '--json');
  assert.equal(empty.status, 0, empty.stderr);
  assert.equal(JSON.parse(empty.stdout).installations[0].installed, true);
  assert.deepEqual(JSON.parse(empty.stdout).installations[0].assets, []);
  for (const broken of ['{', JSON.stringify({ ...manifest, target: '/wrong-target' }),
    JSON.stringify({ ...manifest, files: [{ ...manifest.files[0], path: '../outside' }] })]) {
    await writeFile(context.manifest, broken);
    const result = run(dir, 'status', '--agent', 'codex', '--scope', 'project', '--json');
    assert.equal(result.status, 1);
    assert.match(JSON.parse(result.stdout).installations[0].error, /Cannot read installation manifest/);
    assert.equal(await readFile(context.manifest, 'utf8'), broken);
    const text = run(dir, 'status', '--agent', 'codex', '--scope', 'project');
    assert.equal(text.status, 1);
    assert.match(text.stdout, /Error:/);
    assert.doesNotMatch(text.stdout, /No managed installation found/);
  }
});

test('status refuses symlinks and non-regular tracked files, leaving external content untouched', async t => {
  const dir = await temporary(t);
  const context = await targetContext('project', dir, dir, 'codex');
  await applyInstall(await planInstall(context, [output('linked'), output('directory')], '.'));
  const external = path.join(dir, 'external');
  await writeFile(external, 'external content');
  const linked = path.join(context.target, output('linked').path);
  await rm(linked);
  await symlink(external, linked);
  const directory = path.join(context.target, output('directory').path);
  await rm(directory);
  await mkdir(directory);
  const before = await snapshot(dir);
  const result = run(dir, 'status', '--agent', 'codex', '--scope', 'project', '--json');
  assert.equal(result.status, 1);
  const files = JSON.parse(result.stdout).installations[0].files;
  assert.ok(files.every((file: { status: string }) => file.status === 'unreadable'));
  assert.ok(files.some((file: { error: string }) => /Symlink not allowed/.test(file.error)));
  assert.ok(files.some((file: { error: string }) => /Expected regular file/.test(file.error)));
  assert.deepEqual(await snapshot(dir), before);
  await rm(context.manifest);
  await symlink(external, context.manifest);
  const rejected = await inspectInstallation(context);
  assert.match(rejected.error!, /Symlink not allowed/);
  assert.equal(await readFile(external, 'utf8'), 'external content');
});

test('inspection validates flags and project paths before inspecting anything', async t => {
  const dir = await temporary(t);
  for (const args of [
    ['status', '--agent', 'unknown'], ['status', '--scope', 'unknown'],
    ['status', '--project', path.join(dir, 'missing')], ['status', '--source', dir],
    ['list', '--scope', 'project'], ['install', '--json'],
  ]) {
    const result = run(dir, ...args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr);
  }
  assert.deepEqual(await readdir(dir), []);
});

test('help is command-specific and documents actual entrypoints, examples, and inspection defaults', async t => {
  const dir = await temporary(t);
  const global = run(dir, '--help');
  assert.equal(global.status, 0, global.stderr);
  assert.match(global.stdout, /Usage: agent-stuff/);
  assert.ok(global.stdout.indexOf('status') < global.stdout.indexOf('Contributor commands'));
  assert.doesNotMatch(global.stdout, /npm run cli/);
  for (const command of ['list', 'status', 'install', 'update', 'uninstall', 'recover', 'validate', 'build']) {
    const result = run(dir, command, '--help');
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.startsWith(`Usage: agent-stuff ${command} [options]`));
    assert.match(result.stdout, /Options:/);
    assert.ok(result.stdout.includes(`Example:\n  agent-stuff ${command}`));
    if (['list', 'status', 'validate'].includes(command)) assert.doesNotMatch(result.stdout, /--yes|--out|--accept-limitations/);
  }
  assert.match(run(dir, 'status', '--help').stdout, /all AI tools, both scopes, current directory/);
  assert.equal(run(dir, 'unknown', '--help').status, 1);
  assert.deepEqual(await readdir(dir), []);
});

test('launcher preserves global help and keeps preparation logs out of JSON stdout', async t => {
  const dir = await temporary(t);
  // Build an isolated checkout: the launcher must not clean the running suite's dist/.
  const checkout = path.join(dir, 'checkout');
  await mkdir(checkout);
  for (const entry of ['core', 'tool', 'adapters', 'scripts', 'package.json', 'tsconfig.json', 'install.sh']) {
    await cp(entry, path.join(checkout, entry), { recursive: true });
  }
  await symlink(path.resolve('node_modules'), path.join(checkout, 'node_modules'));
  const launcher = path.join(checkout, 'install.sh');
  const env = { ...process.env, HOME: dir, NO_COLOR: '1' };
  const help = spawnSync('bash', [launcher, '--help'], { cwd: dir, env, encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /End-user commands:/);
  assert.equal(help.stderr, '');
  const stateFile = path.join(checkout, 'dist/.build-state.json');
  const built = await readFile(stateFile, 'utf8');
  const listed = spawnSync('bash', [launcher, 'list', '--agent', 'claude-code', '--json'], { cwd: dir, env, encoding: 'utf8' });
  assert.equal(listed.status, 0, listed.stderr);
  assert.ok(JSON.parse(listed.stdout).items.length);
  assert.equal(listed.stderr, '');
  assert.equal(await readFile(stateFile, 'utf8'), built);
  const probe = path.join(checkout, 'tool/src/cache-probe.ts');
  await writeFile(probe, 'export const probe = true;\n');
  const rebuilt = spawnSync('bash', [launcher, '--help'], { cwd: dir, env, encoding: 'utf8' });
  assert.equal(rebuilt.status, 0, rebuilt.stderr);
  assert.equal(rebuilt.stderr, '');
  const changed = await readFile(stateFile, 'utf8');
  assert.notEqual(changed, built);
  await rm(probe);
  await writeFile(path.join(checkout, 'dist/tool/src/cli.js'), 'invalid output');
  const status = spawnSync('bash', [launcher, 'status', '--json'], { cwd: dir, env, encoding: 'utf8' });
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).installations.length, 6);
  assert.equal(status.stderr, '');
  assert.equal(await readFile(stateFile, 'utf8'), built);
  await assert.rejects(readFile(path.join(checkout, 'dist/tool/src/cache-probe.js')), { code: 'ENOENT' });
  await writeFile(probe, 'const broken: string = 42;\n');
  const failed = spawnSync('bash', [launcher, '--help'], { cwd: dir, env, encoding: 'utf8' });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /error TS/);
  assert.equal(failed.stdout, '');
  assert.deepEqual(await readdir(dir), ['checkout']);
});
