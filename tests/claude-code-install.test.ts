import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import { loadCatalog } from '../core/src/index.js';

for (const scope of ['project', 'global']) {
  test(`Claude Code CLI installs review files in the correct ${scope} locations`, async t => {
    const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'agent-stuff-claude-install-')));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const home = path.join(directory, 'home');
    const project = path.join(directory, 'project');
    await mkdir(home); await mkdir(project);
    const base = scope === 'project' ? project : home;
    const target = path.join(base, '.claude');
    const manifestPath = path.join(base, `.agent-stuff/installations/${scope}/claude-code.json`);
    const env = { ...process.env, HOME: home,
      XDG_CONFIG_HOME: path.join(home, '.config'), XDG_DATA_HOME: path.join(home, '.local/share') };
    const destination = ['--agent', 'claude-code', '--scope', scope,
      ...(scope === 'project' ? ['--project', project] : [])];
    const selection = ['--only', 'skill/bdv-code-review', '--only', 'agent/bdv-reviewer'];
    const run = (...args: string[]) => execFileSync(process.execPath,
      [path.resolve('dist/tool/src/cli.js'), ...args], {
        cwd: project, env, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'],
      });
    const install = [...destination, '--source', path.resolve('.'), ...selection];

    run('install', ...install, '--dry-run');
    await assert.rejects(access(target), { code: 'ENOENT' });
    await assert.rejects(access(manifestPath), { code: 'ENOENT' });
    assert.match(run('install', ...install, '--yes'), /install complete/);

    const catalog = await loadCatalog(path.resolve('core'));
    const skill = catalog.get('skill/bdv-code-review')!;
    const reviewer = catalog.get('agent/bdv-reviewer')!;
    const files = [
      'skills/bdv-code-review/SKILL.md',
      ...[...skill.resources.keys()].map(resource => `skills/bdv-code-review/${resource}`),
      'agents/bdv-reviewer.md',
    ];
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(manifest.target, target);
    assert.deepEqual(manifest.files.map((file: { path: string }) => file.path).sort(), files.sort());
    for (const [resource, bytes] of skill.resources) {
      assert.deepEqual(await readFile(path.join(target, 'skills/bdv-code-review', resource)), bytes);
    }
    const installedSkill = await readFile(path.join(target, 'skills/bdv-code-review/SKILL.md'), 'utf8');
    assert.ok(installedSkill.endsWith(skill.body));
    const skillMetadata = parse(installedSkill.split('---')[1]!);
    assert.equal(skillMetadata.name, 'bdv-code-review');
    assert.equal(skillMetadata['disable-model-invocation'], true);
    const installedReviewer = await readFile(path.join(target, 'agents/bdv-reviewer.md'), 'utf8');
    assert.ok(installedReviewer.endsWith(reviewer.body));
    const reviewerMetadata = parse(installedReviewer.split('---')[1]!);
    assert.equal(reviewerMetadata.name, 'bdv-reviewer');
    assert.deepEqual(reviewerMetadata.tools, ['Read', 'Glob', 'Grep']);
    for (const other of ['.agents', '.opencode', '.codex']) {
      await assert.rejects(access(path.join(base, other)), { code: 'ENOENT' });
    }
    const otherBase = scope === 'project' ? home : project;
    await assert.rejects(access(path.join(otherBase, '.claude')), { code: 'ENOENT' });

    run('install', ...install, '--yes');
    assert.deepEqual(JSON.parse(await readFile(manifestPath, 'utf8')), manifest);
    const status = JSON.parse(run('status', ...destination, '--json'));
    assert.equal(status.installations.length, 1);
    assert.equal(status.installations[0].files.length, files.length);
    assert.ok(status.installations[0].files.every((file: { status: string }) => file.status === 'unchanged'));

    const unrelated = path.join(target, 'keep.txt');
    await writeFile(unrelated, 'user-owned content\n');
    run('uninstall', ...destination, ...selection, '--yes');
    for (const file of files) await assert.rejects(access(path.join(target, file)), { code: 'ENOENT' });
    assert.equal(await readFile(unrelated, 'utf8'), 'user-owned content\n');
  });
}
