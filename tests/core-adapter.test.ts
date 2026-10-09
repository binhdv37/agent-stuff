import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, readFile, writeFile, cp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadCatalog, selectAssets, definitionSchema } from '../core/src/index.js';
import { opencode } from '../adapters/opencode/index.js';
import { applyInstall, planInstall, targetContext, validateOutputs } from '../tool/src/installation/index.js';
import type { OutputFile } from '../tool/src/adapter.js';

const fixture = path.resolve('tests/fixtures');
async function temporary(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'agent-stuff-test-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
const file = (content = 'initial'): OutputFile => ({ asset: 'skill/example', path: 'skills/example/SKILL.md', content: Buffer.from(content) });

test('loads representative assets and preserves instruction and resource bytes', async () => {
  const catalog = await loadCatalog(path.join(fixture, 'core'));
  assert.equal(catalog.size, 7);
  for (const asset of catalog.values()) {
    if (asset.definition.kind !== 'skill') continue;
    const original = await readFile(`core/skills/${asset.definition.id}/instructions.md`, 'utf8');
    assert.equal(asset.body, original);
    for (const [resource, content] of asset.resources) assert.deepEqual(content, await readFile(`core/skills/${asset.definition.id}/${resource}`));
  }
  assert.equal(catalog.get('skill/bdv-teach')!.resources.size, 4);
  assert.equal(catalog.get('skill/bdv-handoff')!.definition.display_name, 'Handoff');
});

test('schema rejects unknown fields, versions, unsafe paths and duplicate resources', () => {
  const valid = { schema_version: 1, kind: 'skill', id: 'example', description: 'Example', instructions: 'instructions.md' };
  assert.equal(definitionSchema.parse(valid).kind, 'skill');
  for (const change of [{ permission: 'allow' }, { schema_version: 2 }, { instructions: '../outside' }, { instructions: '/outside' }, { instructions: 'C:\\outside' }, { resources: ['a', 'a'] }]) {
    assert.equal(definitionSchema.safeParse({ ...valid, ...change }).success, false);
  }
});

test('loader rejects missing references with asset context', async t => {
  const dir = await temporary(t);
  await cp(fixture, dir, { recursive: true });
  await writeFile(path.join(dir, 'core/commands/bdv-change-report/definition.yaml'), 'schema_version: 1\nkind: command\nid: bdv-change-report\ndescription: Example\nworkflow: skill/missing\n');
  await assert.rejects(loadCatalog(path.join(dir, 'core')), /command\/bdv-change-report: missing workflow/);
});

test('loader rejects symlink resources', async t => {
  const dir = await temporary(t);
  await cp(fixture, dir, { recursive: true });
  const resource = path.join(dir, 'core/skills/bdv-teach/GLOSSARY-FORMAT.md');
  await rm(resource);
  await symlink(path.join(dir, 'core/skills/bdv-teach/MISSION-FORMAT.md'), resource);
  await assert.rejects(loadCatalog(path.join(dir, 'core')), /Symlink not allowed/);
});

test('OpenCode reports explicit invocation limit and blocks unverified agent policy', async () => {
  const catalog = await loadCatalog(path.join(fixture, 'core'));
  const skill = catalog.get('skill/bdv-api-handoff')!;
  assert.equal(opencode.check(skill, catalog).status, 'limited');
  const files = opencode.render(skill, catalog);
  assert.equal(files.length, 2);
  assert.match(files[0]!.content.toString(), /Do not invoke automatically/);
  assert.doesNotMatch(files[0]!.content.toString(), /disable-model-invocation/);
  const agent = catalog.get('agent/solution-architect')!;
  assert.equal(opencode.check(agent, catalog).status, 'unsupported');
  assert.throws(() => opencode.render(agent, catalog), /Cannot render/);
});

test('command includes authoritative workflow and argument wrapper', async () => {
  const catalog = await loadCatalog(path.join(fixture, 'core'));
  const asset = catalog.get('command/bdv-change-report')!;
  const output = opencode.render(asset, catalog)[0]!;
  assert.match(output.content.toString(), /Arguments: \$ARGUMENTS/);
  assert.ok(output.content.toString().endsWith(catalog.get('skill/bdv-change-report')!.body));
  assert.throws(() => selectAssets(catalog, ['skill/missing']), /Unknown asset/);
});

test('output validation catches case and parent collisions', () => {
  assert.throws(() => validateOutputs([file(), { ...file(), path: 'skills/example/skill.md' }]), /collision/);
  assert.throws(() => validateOutputs([file(), { ...file(), path: 'skills/example/SKILL.md/nested' }]), /conflict/);
  assert.throws(() => validateOutputs([{ ...file(), path: '../outside' }]));
});

test('preview creates nothing; install is repeatable and updates tracked unchanged files', async t => {
  const dir = await temporary(t);
  const context = await targetContext('project', dir, dir);
  const plan = await planInstall(context, [file()], fixture);
  assert.equal(plan.changes[0]!.action, 'create');
  await assert.rejects(readFile(context.manifest), { code: 'ENOENT' });
  await assert.rejects(readFile(path.join(context.target, file().path)), { code: 'ENOENT' });
  await applyInstall(plan);
  const manifest = await readFile(context.manifest);
  const repeat = await planInstall(context, [file()], fixture);
  assert.equal(repeat.changes[0]!.action, 'unchanged');
  await applyInstall(repeat);
  assert.deepEqual(await readFile(context.manifest), manifest);
  const update = await planInstall(context, [file('new')], fixture);
  assert.equal(update.changes[0]!.action, 'update');
  await applyInstall(update);
  assert.equal(await readFile(path.join(context.target, file().path), 'utf8'), 'new');
});

test('untracked and locally edited files conflict without overwrite', async t => {
  const dir = await temporary(t);
  const context = await targetContext('project', dir, dir);
  await applyInstall(await planInstall(context, [file()], fixture));
  await writeFile(path.join(context.target, file().path), 'my changes');
  const conflict = await planInstall(context, [file('replacement')], fixture);
  assert.equal(conflict.changes[0]!.action, 'conflict');
  await assert.rejects(applyInstall(conflict), /conflicts/);
  assert.equal(await readFile(path.join(context.target, file().path), 'utf8'), 'my changes');
  const untracked = { ...file(), path: 'skills/example/untracked.md' };
  await writeFile(path.join(context.target, untracked.path), untracked.content);
  const plan = await planInstall(context, [file(), untracked], fixture);
  assert.equal(plan.changes[1]!.action, 'conflict');
});

test('partial install preserves other records and detects edits after preview', async t => {
  const dir = await temporary(t);
  const context = await targetContext('project', dir, dir);
  await applyInstall(await planInstall(context, [file()], fixture));
  const other = { ...file(), asset: 'skill/other', path: 'skills/other/SKILL.md' };
  await applyInstall(await planInstall(context, [other], fixture));
  assert.equal(JSON.parse(await readFile(context.manifest, 'utf8')).files.length, 2);
  const stale = await planInstall(context, [file('updated')], fixture);
  await writeFile(path.join(context.target, file().path), 'edit after preview');
  await assert.rejects(applyInstall(stale), /changed since preview/);
});

test('global and project are isolated; destination symlinks are rejected', async t => {
  const dir = await temporary(t);
  const global = await targetContext('global', dir, dir);
  const project = await targetContext('project', dir, dir);
  assert.notEqual(global.target, project.target);
  await mkdir(path.join(dir, 'external'));
  await symlink(path.join(dir, 'external'), project.target);
  await assert.rejects(planInstall(project, [file()], fixture), /Symlink not allowed/);
  await applyInstall(await planInstall(global, [file()], fixture));
  assert.equal(await readFile(path.join(global.target, file().path), 'utf8'), 'initial');
});

test('malformed manifest fails before mutation and updates plan stale removals', async t => {
  const dir = await temporary(t);
  const context = await targetContext('project', dir, dir);
  await applyInstall(await planInstall(context, [file()], fixture));
  const update = await planInstall(context, [{ ...file(), path: 'skills/example/renamed.md' }], fixture);
  assert.equal(update.changes.find(c => c.path === file().path)?.action, 'remove');
  const manifest = JSON.parse(await readFile(context.manifest, 'utf8'));
  manifest.files[0].path = '../outside';
  await writeFile(context.manifest, JSON.stringify(manifest));
  await assert.rejects(planInstall(context, [file()], fixture));
});

test('CLI builds and previews fixture without touching install target', async t => {
  const dir = await temporary(t);
  const cli = path.resolve('dist/tool/src/cli.js');
  const args = ['--agent', 'opencode', '--source', fixture, '--only', 'skill/bdv-api-handoff'];
  const run = (...rest: string[]) => execFileSync(process.execPath, [cli, ...rest], { encoding: 'utf8' });
  assert.match(run('validate', '--source', fixture), /Validated 7 assets/);
  assert.match(run('build', ...args, '--out', path.join(dir, 'output')), /Built 2 files/);
  assert.match(run('install', ...args, '--scope', 'project', '--project', dir, '--dry-run'), /create/);
  const context = await targetContext('project', dir, dir);
  await assert.rejects(readFile(context.manifest), { code: 'ENOENT' });
  await assert.rejects(readFile(path.join(context.target, 'skills/bdv-api-handoff/SKILL.md')), { code: 'ENOENT' });
  assert.match(run('install', ...args, '--scope', 'project', '--project', dir, '--yes', '--accept-limitations'), /install complete/);
});
