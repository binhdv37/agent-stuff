import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';
import { loadCatalog, selectAssets } from '../core/src/index.js';
import { getAdapter } from '../adapters/index.js';
import { applyInstall, planInstall, targetContext } from '../tool/src/installation/index.js';

for (const scope of ['project', 'global'] as const) {
  test(`delegated implementation installs explicit skill and writable helper in ${scope} scope`, async t => {
    const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'agent-stuff-implement-')));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const catalog = await loadCatalog('core');
    const skill = catalog.get('skill/bdv-implement')!;
    const helper = catalog.get('agent/bdv-implementer')!;
    assert.equal(skill.definition.kind === 'skill' && skill.definition.activation, 'explicit');
    assert.deepEqual(selectAssets(catalog, [skill.key]).map(asset => asset.key), [skill.key]);
    const adapter = getAdapter('opencode');
    assert.equal(adapter.check(skill, catalog).status, 'limited');
    assert.equal(adapter.check(helper, catalog).status, 'supported');
    for (const id of ['codex', 'claude-code']) {
      assert.equal(getAdapter(id).check(helper, catalog).status, 'unsupported');
    }
    const context = await targetContext(scope, directory, directory, 'opencode');
    assert.equal(context.target, path.join(directory, scope === 'project' ? '.opencode' : '.config/opencode'));
    const files = [skill, helper].flatMap(asset => adapter.render(asset, catalog));
    assert.deepEqual(files.map(file => file.path), ['skills/bdv-implement/SKILL.md', 'agents/bdv-implementer.md']);
    await applyInstall(await planInstall(context, files, '.'));
    for (const file of files) {
      assert.deepEqual(await readFile(path.join(context.target, file.path)), Buffer.from(file.content));
    }
    const rendered = await readFile(path.join(context.target, 'agents/bdv-implementer.md'), 'utf8');
    const metadata = parse(rendered.split('---')[1]!);
    assert.equal(metadata.mode, 'subagent');
    assert.deepEqual(metadata.permission, {
      '*': 'deny', read: 'allow', glob: 'allow', grep: 'allow', list: 'allow',
      edit: 'allow', bash: 'allow', question: 'deny', task: 'deny', external_directory: 'deny',
    });
    assert.ok(rendered.includes(helper.body.toString()));
    assert.ok((await readFile(path.join(context.target, 'skills/bdv-implement/SKILL.md'), 'utf8')).includes(skill.body.toString()));
    const repeat = await planInstall(context, files, '.');
    assert.ok(repeat.changes.every(change => change.action === 'unchanged'));
  });
}
