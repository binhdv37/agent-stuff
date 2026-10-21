import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import { loadCatalog, selectAssets } from '../core/src/index.js';
import { getAdapter } from '../adapters/index.js';
import { applyInstall, planInstall, targetContext } from '../tool/src/installation/index.js';

async function install(t: { after: (fn: () => Promise<void>) => void }) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'agent-stuff-code-review-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const catalog = await loadCatalog(path.resolve('core'));
  const selected = selectAssets(catalog, ['skill/bdv-code-review', 'agent/bdv-reviewer']);
  const adapter = getAdapter('opencode');
  const context = await targetContext('project', directory, directory, 'opencode');
  await applyInstall(await planInstall(context, selected.flatMap(asset => adapter.render(asset, catalog)), '.'));
  return { directory, context, catalog, adapter };
}

test('code review installs its five rubrics and shell-denied reviewer together', async t => {
  const { context, catalog, adapter } = await install(t);
  const skill = catalog.get('skill/bdv-code-review')!;
  const reviewer = catalog.get('agent/bdv-reviewer')!;
  assert.equal(adapter.check(skill, catalog).status, 'limited');
  assert.equal(adapter.check(reviewer, catalog).status, 'supported');
  assert.equal(skill.definition.kind === 'skill' && skill.definition.activation, 'explicit');
  assert.equal(skill.resources.size, 5);
  for (const [resource, bytes] of skill.resources) {
    assert.deepEqual(await readFile(path.join(context.target, 'skills/bdv-code-review', resource)), bytes);
  }
  const agent = await readFile(path.join(context.target, 'agents/bdv-reviewer.md'), 'utf8');
  const metadata = parse(agent.split('---')[1]!);
  assert.equal(metadata.mode, 'subagent');
  assert.equal(metadata.permission.read, 'allow');
  for (const tool of ['*', 'edit', 'bash', 'task', 'question', 'external_directory']) {
    assert.equal(metadata.permission[tool], 'deny');
  }
});

test('OpenCode discovers code review and enables only read/search tools on its reviewer', async t => {
  try { execFileSync('opencode', ['--version'], { stdio: 'ignore' }); }
  catch { t.skip('OpenCode binary is unavailable'); return; }
  const { directory, context } = await install(t);
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: directory, PWD: directory,
    XDG_CONFIG_HOME: path.join(directory, 'config'), XDG_DATA_HOME: path.join(directory, 'data'),
    XDG_CACHE_HOME: path.join(directory, 'cache'), XDG_STATE_HOME: path.join(directory, 'state'),
    OPENCODE_DISABLE_EXTERNAL_SKILLS: 'true', OPENCODE_DISABLE_CLAUDE_CODE: '1' };
  for (const key of Object.keys(env)) {
    if (key.startsWith('OPENCODE_') && !['OPENCODE_DISABLE_EXTERNAL_SKILLS', 'OPENCODE_DISABLE_CLAUDE_CODE'].includes(key)) {
      delete env[key];
    }
  }
  const debug = (...args: string[]) => JSON.parse(execFileSync('opencode', ['--pure', 'debug', ...args], {
    cwd: directory, env, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'],
  }));
  const skills = debug('skill') as { name: string; location: string; content: string }[];
  const skill = skills.find(item => item.name === 'bdv-code-review');
  assert.ok(skill);
  assert.equal(skill.location, path.join(context.target, 'skills/bdv-code-review/SKILL.md'));
  assert.ok(skill.content.includes('## 2. Fan out the review'));
  const reviewer = debug('agent', 'bdv-reviewer');
  assert.equal(reviewer.mode, 'subagent');
  for (const tool of ['read', 'glob', 'grep']) assert.equal(reviewer.tools[tool], true, tool);
  for (const tool of ['edit', 'write', 'bash', 'task', 'question']) assert.equal(reviewer.tools[tool], false, tool);
});
