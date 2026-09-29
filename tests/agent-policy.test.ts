import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import { loadCore, selectAssets } from '../tool/src/core/load.js';
import { opencode } from '../adapters/opencode/index.js';
import { applyInstall, planInstall, targetContext } from '../tool/src/installation/index.js';

async function temporary(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'agent-stuff-agents-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('planner selection includes its restricted delegate and both bundled primary agents render', async () => {
  const catalog = await loadCore('.');
  assert.deepEqual(selectAssets(catalog, ['agent/experimental-plan']).map(a => a.key),
    ['agent/bdv-plan-reviewer', 'agent/experimental-plan']);
  for (const id of ['experimental-plan', 'solution-architect']) {
    const asset = catalog.get(`agent/${id}`)!;
    assert.equal(opencode.check(asset, catalog).status, 'supported');
    assert.equal(opencode.render(asset, catalog).length, 1);
  }
  const planner = parse(opencode.render(catalog.get('agent/experimental-plan')!, catalog)[0]!.content.toString().split('---')[1]!);
  assert.equal(planner.mode, 'primary');
  assert.deepEqual(planner.permission.edit, {
    '*': 'deny', '.auragent/plans/*': 'allow',
  });
  assert.deepEqual(planner.permission.task, { '*': 'deny', 'bdv-plan-reviewer': 'allow' });
  assert.equal(planner.permission.bash, 'deny');
  assert.equal(planner.permission.external_directory, 'deny');
  const architect = parse(opencode.render(catalog.get('agent/solution-architect')!, catalog)[0]!.content.toString().split('---')[1]!);
  assert.equal(architect.permission.bash, 'deny');
  assert.equal(architect.permission.edit, 'deny');
  const reviewer = parse(opencode.render(catalog.get('agent/bdv-plan-reviewer')!, catalog)[0]!.content.toString().split('---')[1]!);
  assert.equal(reviewer.mode, 'subagent');
  assert.equal(reviewer.permission.edit, 'deny');
  assert.equal(reviewer.permission.bash, 'deny');
  assert.equal(reviewer.permission.task, 'deny');
});

test('agent dependency validation refuses a delegate that can edit or use shell', async t => {
  const dir = await temporary(t);
  const { cp, writeFile } = await import('node:fs/promises');
  await cp('core', path.join(dir, 'core'), { recursive: true });
  const definition = path.join(dir, 'core/agents/bdv-plan-reviewer/definition.yaml');
  const original = await readFile(definition, 'utf8');
  await writeFile(definition, original.replace('workspace_write: deny', 'workspace_write: allow'));
  await assert.rejects(loadCore(dir), /delegate agent\/bdv-plan-reviewer must be read-only/);
  await writeFile(definition, original.replace('shell: deny', 'shell: ask'));
  await assert.rejects(loadCore(dir), /delegate agent\/bdv-plan-reviewer must be read-only/);
});

test('runtime OpenCode discovers generated agents with restricted permissions', async t => {
  try { execFileSync('opencode', ['--version'], { stdio: 'ignore' }); }
  catch { t.skip('OpenCode binary is unavailable'); return; }
  const dir = await temporary(t);
  const catalog = await loadCore('.');
  const selected = selectAssets(catalog, ['agent/experimental-plan', 'agent/solution-architect']);
  const outputs = selected.flatMap(a => opencode.render(a, catalog));
  const context = await targetContext('project', dir, dir);
  await applyInstall(await planInstall(context, outputs, '.'));
  const env = { ...process.env,
    XDG_CONFIG_HOME: path.join(dir, 'config'), XDG_DATA_HOME: path.join(dir, 'data'),
    XDG_CACHE_HOME: path.join(dir, 'cache'), XDG_STATE_HOME: path.join(dir, 'state'),
    OPENCODE_DISABLE_EXTERNAL_SKILLS: 'true' };
  function debug(id: string): { name: string; mode: string; permission: { permission: string; action: string; pattern: string }[]; tools: Record<string, boolean> } {
    return JSON.parse(execFileSync('opencode', ['--pure', 'debug', 'agent', id], {
      cwd: dir, env, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'],
    }));
  }
  const architect = debug('solution-architect');
  assert.equal(architect.mode, 'primary');
  assert.equal(architect.tools.bash, false);
  assert.equal(architect.tools.edit, false);
  assert.equal(architect.tools.write, false);
  assert.equal(architect.tools.read, true);
  const planner = debug('experimental-plan');
  assert.equal(planner.mode, 'primary');
  assert.equal(planner.tools.bash, false);
  assert.ok(planner.permission.some(p => p.permission === 'edit' && p.pattern === '.auragent/plans/*' && p.action === 'allow'));
  assert.ok(planner.permission.some(p => p.permission === 'task' && p.pattern === 'bdv-plan-reviewer' && p.action === 'allow'));
  assert.ok(planner.permission.some(p => p.permission === 'task' && p.pattern === '*' && p.action === 'deny'));
  const reviewer = debug('bdv-plan-reviewer');
  assert.equal(reviewer.mode, 'subagent');
  assert.equal(reviewer.tools.edit, false);
  assert.equal(reviewer.tools.bash, false);
});
