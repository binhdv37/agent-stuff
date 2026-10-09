import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import { loadCatalog } from '../core/src/index.js';
import { getAdapter } from '../tool/src/registry.js';

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const temporary = await mkdtemp(path.join(tmpdir(), 'agent-stuff-smart-commit-test-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const project = path.join(temporary, 'project');
  await mkdir(project);
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_COUNT: '0', GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_INDEX_FILE: undefined,
    GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
  const git = (...args: string[]) => execFileSync('git', args, { cwd: project, env, encoding: 'utf8' }).trim();
  git('init', '-q'); git('config', 'core.hooksPath', '/dev/null'); git('config', 'commit.gpgSign', 'false');
  await writeFile(path.join(project, 'agent.txt'), 'initial\n');
  await writeFile(path.join(project, 'other.txt'), 'initial\n');
  git('add', '--', 'agent.txt', 'other.txt'); git('commit', '-qm', 'chore: fixture');
  return { temporary, project, git };
}

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

test('whole-file only commit preserves an excluded staged file and treats pathspec names literally', async t => {
  const f = await fixture(t), selected = ':(glob)*.txt';
  await writeFile(path.join(f.project, selected), 'approved addition\n');
  await writeFile(path.join(f.project, 'other.txt'), 'pre-existing user edit\n');
  f.git('--literal-pathspecs', 'add', '--', 'other.txt');
  const excludedEntry = f.git('--literal-pathspecs', 'ls-files', '--stage', '-v', '--', 'other.txt');
  f.git('--literal-pathspecs', 'add', '--', selected);
  assert.equal(f.git('--literal-pathspecs', 'ls-files', '--stage', '-v', '--', 'other.txt'), excludedEntry);
  f.git('--literal-pathspecs', 'commit', '--only', '-qm', 'feat: add selected fixture', '--', selected);
  assert.equal(f.git('diff-tree', '--no-commit-id', '--name-only', '-r', '-z', 'HEAD'), selected + '\0');
  assert.equal(f.git('show', `HEAD:${selected}`), 'approved addition');
  assert.equal(f.git('--literal-pathspecs', 'ls-files', '--stage', '-v', '--', 'other.txt'), excludedEntry);
  assert.equal(f.git('diff', '--cached', '--name-only'), 'other.txt');
  assert.equal(await readFile(path.join(f.project, 'other.txt'), 'utf8'), 'pre-existing user edit\n');
});

test('only commits working-tree hunks, so cannot isolate a mixed selected file', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.project, 'agent.txt'), 'user hunk\ninitial timeout\n');
  f.git('add', '--', 'agent.txt');
  await writeFile(path.join(f.project, 'agent.txt'), 'user hunk\nagent timeout\n');
  f.git('--literal-pathspecs', 'commit', '--only', '-qm', 'fix: demonstrate whole-file semantics', '--', 'agent.txt');
  assert.equal(f.git('show', 'HEAD:agent.txt'), 'user hunk\nagent timeout');
  assert.equal(f.git('diff', '--cached', '--name-only'), '');
});

test('staged-only ordinary commit excludes the selected file unstaged contents', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.project, 'agent.txt'), 'approved staged content\n');
  f.git('add', '--', 'agent.txt');
  await writeFile(path.join(f.project, 'agent.txt'), 'unapproved working content\n');
  f.git('commit', '-qm', 'fix: commit staged content');
  assert.equal(f.git('show', 'HEAD:agent.txt'), 'approved staged content');
  assert.equal(await readFile(path.join(f.project, 'agent.txt'), 'utf8'), 'unapproved working content\n');
  assert.equal(f.git('diff', '--name-only'), 'agent.txt');
});
