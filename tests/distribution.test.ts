import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { adapterIds } from '../adapters/index.js';
import { readManifest, targetContext } from '../tool/src/installation/index.js';
import { resolveSource } from '../tool/src/source.js';

test('npm artifact updates all harnesses/scopes after its original source is removed', async t => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'agent-stuff-package-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const [packed] = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', dir], { encoding: 'utf8' }));
  const names: string[] = packed.files.map((file: { path: string }) => file.path);
  assert.ok(names.includes('dist/tool/src/cli.js'));
  assert.ok(names.includes('dist/core/docs/concepts.md'));
  assert.ok(names.includes('core/skills/bdv-explain-code/instructions.md'));
  assert.ok(!names.some(name => /^(tests|verification|tool|scripts)\//.test(name)));
  assert.ok(!names.some(name => /^(core\/src|dist\/tests)\//.test(name)));
  const oldRoot = path.join(dir, 'package');
  execFileSync('tar', ['-xzf', path.join(dir, packed.filename), '-C', dir]);
  const newRoot = path.join(dir, 'new-package');
  await cp(oldRoot, newRoot, { recursive: true });
  // Content tests reuse dependencies; fresh npm dependency installation is a
  // separate smoke check so the default suite does not require registry access.
  for (const root of [oldRoot, newRoot]) await symlink(path.resolve('node_modules'), path.join(root, 'node_modules'));
  const metadata = JSON.parse(await readFile(path.join(newRoot, 'package.json'), 'utf8'));
  await writeFile(path.join(newRoot, 'package.json'), JSON.stringify({ ...metadata, version: '0.2.0' }));
  const instructions = path.join(newRoot, 'core/skills/bdv-explain-code/instructions.md');
  await writeFile(instructions, await readFile(instructions, 'utf8') + '\nPackage update marker.\n');
  const home = path.join(dir, 'home');
  const project = path.join(dir, 'project');
  await mkdir(home); await mkdir(project);
  const run = (root: string, ...args: string[]) => {
    const result = spawnSync(process.execPath, [path.join(root, 'dist/tool/src/cli.js'), ...args], {
      cwd: project, env: { ...process.env, HOME: home, NO_COLOR: '1' }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  const flags = (agent: string, scope: string) => ['--agent', agent, '--scope', scope, '--project', project, '--yes'];
  run(oldRoot, 'validate');
  for (const agent of adapterIds) for (const scope of ['project', 'global']) {
    run(oldRoot, 'install', ...flags(agent, scope), '--only', 'skill/bdv-explain-code', '--accept-limitations');
    const context = await targetContext(scope, project, home, agent);
    const installed = (await readManifest(context))!;
    assert.equal(installed.schema_version, 2);
    assert.deepEqual(installed.source, { kind: 'package', name: metadata.name, version: metadata.version });
  }
  await rm(oldRoot, { recursive: true, force: true });
  for (const agent of adapterIds) for (const scope of ['project', 'global']) {
    run(newRoot, 'update', ...flags(agent, scope), '--accept-limitations');
    const context = await targetContext(scope, project, home, agent);
    const installed = (await readManifest(context))!;
    assert.deepEqual(installed.source, { kind: 'package', name: metadata.name, version: '0.2.0' });
    assert.match(await readFile(path.join(context.target, 'skills/bdv-explain-code/SKILL.md'), 'utf8'), /Package update marker/);
    const status = JSON.parse(run(newRoot, 'status', '--agent', agent, '--scope', scope, '--project', project, '--json'));
    assert.deepEqual(status.installations[0].source, installed.source);
    assert.match(run(newRoot, 'status', '--agent', agent, '--scope', scope, '--project', project), /Source: agent-stuff@0.2.0/);
    assert.ok(installed.files.every(file => file.asset === 'skill/bdv-explain-code'));
  }
  await writeFile(path.join(newRoot, 'package.json'), JSON.stringify({ ...metadata, version: '0.2.1' }));
  run(newRoot, 'update', ...flags('codex', 'project'), '--accept-limitations');
  assert.deepEqual((await readManifest(await targetContext('project', project, home, 'codex')))!.source,
    { kind: 'package', name: metadata.name, version: '0.2.1' });
  // Explicit local overrides migrate back to path-based state, even when the
  // invoking CLI comes from a package. Legacy updates must keep that local path.
  const local = path.join(dir, 'local');
  await mkdir(local);
  await cp(path.join(newRoot, 'core'), path.join(local, 'core'), { recursive: true });
  run(newRoot, 'update', ...flags('codex', 'project'), '--source', local, '--accept-limitations');
  const context = await targetContext('project', project, home, 'codex');
  assert.equal((await readManifest(context))!.schema_version, 1);
  assert.equal((await readManifest(context))!.source, local);
  const localInstructions = path.join(local, 'core/skills/bdv-explain-code/instructions.md');
  await writeFile(localInstructions, await readFile(localInstructions, 'utf8') + '\nLocal update marker.\n');
  run(newRoot, 'update', ...flags('codex', 'project'), '--accept-limitations');
  assert.match(await readFile(path.join(context.target, 'skills/bdv-explain-code/SKILL.md'), 'utf8'), /Local update marker/);
  // Modified managed files continue to block package updates.
  const global = await targetContext('global', project, home, 'codex');
  const managed = path.join(global.target, 'skills/bdv-explain-code/SKILL.md');
  await writeFile(managed, 'personal edits');
  const rejected = spawnSync(process.execPath, [path.join(newRoot, 'dist/tool/src/cli.js'), 'update', ...flags('codex', 'global')], {
    cwd: project, env: { ...process.env, HOME: home }, encoding: 'utf8',
  });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /conflicts/);
  assert.equal(await readFile(managed, 'utf8'), 'personal edits');
  // Uninstall never needs the package source to remain available.
  await rm(newRoot, { recursive: true, force: true });
  run(path.resolve('.'), 'uninstall', ...flags('opencode', 'project'));
  assert.equal((await readManifest(await targetContext('project', project, home, 'opencode')))!.files.length, 0);
});

test('package sources cannot silently switch package identity or become checkout sources', async t => {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'agent-stuff-source-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'different-package', version: '1.0.0' }));
  const recorded = { kind: 'package' as const, name: 'agent-stuff', version: '0.1.0' };
  await assert.rejects(resolveSource(dir, undefined, recorded), /belongs to different-package/);
  await assert.rejects(resolveSource(path.resolve('.'), undefined, recorded), /npx agent-stuff@latest update/);
  const override = await resolveSource(dir, '.', recorded);
  assert.equal(override.source, path.resolve('.'));
});
