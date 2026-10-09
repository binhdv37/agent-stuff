import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { applyInstall, planInstall, planUninstall, targetContext, recoverInstall, readManifest } from '../tool/src/installation/index.js';
import { loadCatalog } from '../core/src/index.js';
import { getAdapter } from '../tool/src/registry.js';
import { adapterIds, type OutputFile } from '../tool/src/adapter.js';

async function temporary(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'agent-stuff-lifecycle-')));
  t.after(() => rm(dir, { recursive: true, force: true })); return dir;
}
const file = (content = 'initial', name = 'SKILL.md'): OutputFile => ({ asset: 'skill/example', path: `skills/example/${name}`, content: Buffer.from(content) });

test('update removes stale resources and uninstall preserves unrelated files', async t => {
  const dir = await temporary(t);
  const context = await targetContext('project', dir, dir);
  await applyInstall(await planInstall(context, [file(), file('resource', 'resource.md')], '.'));
  await writeFile(path.join(context.target, 'skills/example/personal.md'), 'mine');
  await applyInstall(await planInstall(context, [file('updated')], '.'));
  await assert.rejects(readFile(path.join(context.target, 'skills/example/resource.md')), { code: 'ENOENT' });
  await applyInstall(await planUninstall(context));
  assert.equal(await readFile(path.join(context.target, 'skills/example/personal.md'), 'utf8'), 'mine');
  assert.equal((await readManifest(context))!.files.length, 0);
});

test('uninstall refuses local edits and rejects untracked selection', async t => {
  const dir = await temporary(t);
  const context = await targetContext('project', dir, dir);
  await applyInstall(await planInstall(context, [file()], '.'));
  await writeFile(path.join(context.target, file().path), 'mine');
  const plan = await planUninstall(context);
  assert.equal(plan.changes[0]!.action, 'conflict');
  await assert.rejects(applyInstall(plan), /conflicts/);
  await assert.rejects(planUninstall(context, ['skill/missing']), /not installed/);
  assert.equal(await readFile(path.join(context.target, file().path), 'utf8'), 'mine');
});

test('caught write failure rolls back earlier changes and preserves manifest', async t => {
  const dir = await temporary(t);
  const context = await targetContext('project', dir, dir);
  await applyInstall(await planInstall(context, [file()], '.'));
  const before = await readFile(context.manifest);
  const plan = await planInstall(context, [file('new'), file('added', 'resource.md')], '.');
  await assert.rejects(applyInstall(plan, () => { throw new Error('simulated failure'); }), /simulated failure/);
  assert.equal(await readFile(path.join(context.target, file().path), 'utf8'), 'initial');
  assert.deepEqual(await readFile(context.manifest), before);
  await assert.rejects(readFile(`${context.manifest}.journal`), { code: 'ENOENT' });
});

async function crashInstall(dir: string): Promise<void> {
  const module = pathToFileURL(path.resolve('dist/tool/src/installation/index.js')).href;
  const script = `import { applyInstall, planInstall, targetContext } from ${JSON.stringify(module)};
    const context = await targetContext('project', process.argv[1], process.argv[1]);
    const files = [{ asset: 'skill/example', path: 'skills/example/SKILL.md', content: Buffer.from('interrupted') },
      { asset: 'skill/example', path: 'skills/example/resource.md', content: Buffer.from('resource') }];
    await applyInstall(await planInstall(context, files, '.'), () => process.kill(process.pid, 'SIGKILL'));`;
  assert.throws(() => execFileSync(process.execPath, ['--input-type=module', '-e', script, dir], { stdio: 'pipe' }),
    (error: unknown) => (error as { signal: string }).signal === 'SIGKILL');
}

test('actual process interruption is recovered using persistent backups', async t => {
  const dir = await temporary(t);
  const context = await targetContext('project', dir, dir);
  await applyInstall(await planInstall(context, [file()], '.'));
  await crashInstall(dir);
  assert.equal(await readFile(path.join(context.target, file().path), 'utf8'), 'interrupted');
  await assert.rejects(planInstall(context, [file()], '.'), /run recover/);
  assert.match(await recoverInstall(context), /rolled back/);
  assert.equal(await readFile(path.join(context.target, file().path), 'utf8'), 'initial');
  assert.match(await recoverInstall(context), /No interrupted/);
});

test('recovery preserves edits made after a crash and retains journal', async t => {
  const dir = await temporary(t);
  const context = await targetContext('project', dir, dir);
  await crashInstall(dir);
  await writeFile(path.join(context.target, file().path), 'after crash');
  await assert.rejects(recoverInstall(context), /Recovery conflict/);
  assert.equal(await readFile(path.join(context.target, file().path), 'utf8'), 'after crash');
  assert.ok(await readFile(`${context.manifest}.journal`));
});

test('recovery cannot displace a live installer', async t => {
  const dir = await temporary(t);
  const context = await targetContext('project', dir, dir);
  await applyInstall(await planInstall(context, [file()], '.'), async () => {
    await assert.rejects(recoverInstall(context), /still running/);
  });
});

test('three adapters preserve resources and install into isolated scopes', async t => {
  const dir = await temporary(t);
  const catalog = await loadCatalog(path.join('tests/fixtures', 'core'));
  const skill = catalog.get('skill/bdv-api-handoff')!;
  const home = path.join(dir, 'home');
  const project = path.join(dir, 'project');
  await mkdir(home); await mkdir(project);
  for (const id of adapterIds) {
    const adapter = getAdapter(id);
    for (const scope of ['global', 'project']) {
      const context = await targetContext(scope, project, home, id);
      const files = adapter.render(skill, catalog);
      await applyInstall(await planInstall(context, files, 'tests/fixtures'));
      assert.equal(await readFile(path.join(context.target, `skills/${skill.definition.id}/references/handoff-template.md`), 'utf8'), skill.resources.get('references/handoff-template.md')!.toString());
    }
  }
  const codex = getAdapter('codex').render(skill, catalog);
  assert.equal(parse(codex.find(f => f.path.endsWith('openai.yaml'))!.content.toString()).policy.allow_implicit_invocation, false);
  const claude = getAdapter('claude-code').render(skill, catalog)[0]!.content.toString();
  assert.equal(parse(claude.split('---')[1]!)['disable-model-invocation'], true);
});

test('OpenCode maps restrictive agent policy without alternate write paths', async () => {
  const catalog = await loadCatalog(path.join('tests/fixtures', 'core'));
  const original = catalog.get('agent/solution-architect')!;
  const asset = structuredClone(original);
  if (asset.definition.kind !== 'agent') throw new Error('Expected agent');
  asset.definition.policy.shell = 'deny';
  const adapter = getAdapter('opencode');
  assert.equal(adapter.check(asset, catalog).status, 'supported');
  const frontmatter = parse(adapter.render(asset, catalog)[0]!.content.toString().split('---')[1]!);
  assert.equal(frontmatter.mode, 'primary');
  assert.equal(frontmatter.permission['*'], 'deny');
  assert.equal(frontmatter.permission.edit, 'deny');
  assert.equal(frontmatter.permission.bash, 'deny');
  assert.equal(frontmatter.permission.task, 'deny');
  assert.equal(frontmatter.permission.read, 'allow');
});
