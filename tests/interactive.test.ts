import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import * as prompts from '@clack/prompts';
import { loadCatalog } from '../core/src/index.js';
import { getAdapter, adapterIds } from '../adapters/index.js';
import { Cancelled, InteractiveFlow, completionSummary, formatCompatibility, validateProject } from '../tool/src/prompts.js';
import { readManifest, targetContext, type Change, type Plan } from '../tool/src/installation/index.js';
import { formatConflict } from '../tool/src/conflicts.js';

async function temporary(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'agent-stuff-interactive-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

const noopBar = () => ({ start() {}, update() {}, stop() {}, error() {} });

test('project validation rejects blank, missing and file targets', async t => {
  const dir = await temporary(t);
  await writeFile(path.join(dir, 'file'), 'not a directory');
  assert.match(validateProject('  ')!, /Enter the path/);
  assert.match(validateProject(path.join(dir, 'missing'))!, /Check the path/);
  assert.match(validateProject(path.join(dir, 'file'))!, /path is a file/);
  assert.equal(validateProject(dir), undefined);
});

test('declining the source checkout re-prompts for an explicit project with no default', async t => {
  const source = await temporary(t);
  const project = path.join(source, 'project');
  await mkdir(project);
  const entries = [source, project];
  let confirmations = 0;
  const flow = new InteractiveFlow({ ...prompts, bar: noopBar,
    text: async options => {
      assert.equal(options.defaultValue, undefined);
      assert.equal(options.initialValue, undefined);
      assert.equal(options.validate, validateProject);
      return entries.shift()!;
    },
    confirm: async options => { confirmations++; assert.equal(options.initialValue, false); return false; },
  });
  assert.equal(await flow.project(source), project);
  assert.equal(confirmations, 1);
});

test('asset picker starts empty, requires selection and disables unsupported items for every harness', async () => {
  const catalog = await loadCatalog('core');
  for (const id of adapterIds) {
    const adapter = getAdapter(id);
    const chosen = 'skill/bdv-explain-code';
    const flow = new InteractiveFlow({ ...prompts, bar: noopBar,
      multiselect: (async options => {
        assert.deepEqual(options.initialValues, []);
        assert.equal(options.required, true);
        assert.equal(options.options.length, catalog.size);
        for (const option of options.options) {
          const key = String(option.value);
          const result = adapter.check(catalog.get(key)!, catalog);
          assert.equal(option.disabled, result.status === 'unsupported');
          assert.match(option.label!, /^(Skills|Commands|Agents) › /);
          assert.ok(option.hint);
          assert.doesNotMatch(option.hint!, /Do not invoke automatically/);
        }
        return [chosen];
      }) as typeof prompts.multiselect,
    });
    assert.deepEqual(await flow.assets(catalog, adapter), [chosen]);
  }
});

test('escape and declined confirmations cancel with a clear message', async () => {
  let message = '';
  const flow = new InteractiveFlow({ ...prompts, bar: noopBar,
    select: (async () => prompts.CANCEL_SYMBOL) as typeof prompts.select,
    text: async () => prompts.CANCEL_SYMBOL,
    multiselect: (async () => prompts.CANCEL_SYMBOL) as typeof prompts.multiselect,
    confirm: async () => false,
    cancel: value => { message = value ?? ''; },
  });
  await assert.rejects(flow.harness(), Cancelled);
  await assert.rejects(flow.scope(), Cancelled);
  await assert.rejects(flow.project('.'), Cancelled);
  await assert.rejects(flow.assets(new Map(), getAdapter('codex')), Cancelled);
  await assert.rejects(flow.confirm('Apply these changes?'), Cancelled);
  flow.cancel();
  assert.equal(message, 'Cancelled. No files changed.');
});

test('confirmation prompts default to yes while recovery stays a deliberate no', async () => {
  const seen: [string, boolean | undefined][] = [];
  const flow = new InteractiveFlow({ ...prompts, bar: noopBar,
    confirm: async options => { seen.push([options.message, options.initialValue]); return true; },
  });
  await flow.confirm('Accept the compatibility limitations shown above?');
  await flow.confirm('Apply these changes?');
  await flow.confirm('Recover the interrupted installation?', false);
  assert.deepEqual(seen, [
    ['Accept the compatibility limitations shown above?', true],
    ['Apply these changes?', true],
    ['Recover the interrupted installation?', false],
  ]);
});

test('success gives the location and a usable next step for the selected item and scope', () => {
  for (const id of adapterIds) {
    let next = '';
    let completion = '';
    const flow = new InteractiveFlow({ ...prompts, bar: noopBar,
      note: message => { next = message ?? ''; }, outro: message => { completion = message ?? ''; },
    });
    const plan = { context: { adapter: id, target: '/example/target' } } as Plan;
    flow.complete('install', plan, 'project', '/example/project', ['skill/bdv-explain-code']);
    assert.match(next, /Open .* in \/example\/project/);
    assert.match(next, id === 'claude-code' ? /Run \/bdv-explain-code/ : /Ask: Use bdv-explain-code/);
    assert.match(next, /Location: \/example\/target/);
    assert.equal(completion, 'Ready to use.');
    flow.complete('install', plan, 'global', '/irrelevant', ['skill/bdv-explain-code']);
    assert.match(next, /in your project/);
  }
});

test('compatibility preserves every affected field and effect, grouping shared explanations once', async () => {
  const catalog = await loadCatalog('core');
  const adapter = getAdapter('claude-code');
  const results = [...catalog.values()].map(asset => adapter.check(asset, catalog));
  const formatted = formatCompatibility(results, 160);
  const normalized = formatted.replace(/\s+/g, ' ');
  assert.match(formatted, /Item\s+\| Support\s+\| Details/);
  assert.match(formatted, /Full/);
  assert.match(formatted, /Limited/);
  assert.match(formatted, /Not supported/);
  assert.doesNotMatch(formatted, /Native skill|<skill-name>/);
  for (const result of results) {
    assert.ok(formatted.includes(result.asset));
    for (const issue of result.issues) {
      assert.ok(formatted.includes(issue.field), issue.field);
      const effect = (issue.effect || issue.reason).replace(/\s+/g, ' ');
      assert.equal(normalized.split(effect).length - 1, 1, effect);
    }
    if (result.status === 'unsupported' && !result.issues.length) assert.ok(normalized.includes(result.reason));
  }
});

test('compatibility wraps columns and uses compact rows on narrow terminals without losing information', async () => {
  const catalog = await loadCatalog('core');
  const adapter = getAdapter('opencode');
  const results = [...catalog.values()].map(asset => adapter.check(asset, catalog));
  for (const width of [36, 60, 68, 100]) {
    const formatted = formatCompatibility(results, width);
    assert.ok(formatted.split('\n').every(line => line.length <= width));
    assert.doesNotMatch(formatted, /\u001b\[/);
    const normalized = formatted.replace(/\s+/g, ' ');
    for (const result of results) {
      assert.ok(normalized.includes(result.asset));
      for (const issue of result.issues) {
        assert.ok(normalized.includes(issue.field), issue.field);
        assert.ok(normalized.includes((issue.effect || issue.reason).replace(/\s+/g, ' ')));
      }
    }
    if (width < 68) assert.match(formatted, /Support: Limited/);
    else assert.match(formatted, /Item\s+\| Support/);
  }
});

function progressPlan(): Plan {
  return { context: { adapter: 'claude-code', target: '/example/target' }, changes: [
    { asset: 'skill/bdv-explain-code', action: 'create' },
    { asset: 'skill/bdv-explain-code', action: 'create' },
    { asset: 'skill/bdv-handoff', action: 'unchanged' },
    { asset: 'skill/bdv-handoff', action: 'remove' },
  ] } as Plan;
}

test('completion counts distinct items and reports actual file actions including unchanged files', () => {
  assert.equal(completionSummary('install', progressPlan()),
    'Installation complete · 2 skills · 2 files created · 1 file removed · 1 file unchanged');
  const plan = progressPlan();
  plan.changes = [];
  assert.equal(completionSummary('update', plan), 'Update complete · no file changes');
});

test('interactive preview explains every conflict cause with relative paths and concrete next steps', () => {
  const changes: Change[] = [
    { asset: 'skill/edited', path: 'skills/edited/SKILL.md', content: null, before: Buffer.from('mine'),
      action: 'conflict', conflict: { reason: 'modified' } },
    { asset: 'skill/existing', path: 'skills/existing/SKILL.md', content: Buffer.from('new'), before: Buffer.from('existing'),
      action: 'conflict', conflict: { reason: 'unmanaged' } },
    { asset: 'skill/requested', path: 'skills/requested/SKILL.md', content: Buffer.from('new'), before: null,
      action: 'conflict', conflict: { reason: 'other-asset', owner: 'skill/owner' } },
  ];
  let preview = '';
  const flow = new InteractiveFlow({ ...prompts, bar: noopBar,
    note: (message, title) => { assert.equal(title, 'Review changes'); preview = message ?? ''; },
  });
  const plan = { context: { target: '/example/target' }, changes } as Plan;
  flow.preview(plan, 'uninstall');
  assert.match(preview, /Target: \/example\/target/);
  assert.match(preview, /3 conflict/);
  assert.match(preview, /Modified since installation/);
  assert.match(preview, /existing file is not managed/);
  assert.match(preview, /Tracked by another item: skill\/owner/);
  assert.match(preview, /uninstall --only skill\/owner/);
  assert.match(preview, /restore its original installed contents/);
  assert.match(preview, /To remove other items first, select them with --only/);
  for (const change of changes) {
    if (change.action !== 'conflict') continue;
    assert.ok(preview.includes(formatConflict(change, 'uninstall')));
    assert.ok(preview.includes(`! Conflict: ${change.path}`));
    assert.ok(preview.includes(`Item: ${change.asset}`));
  }
  assert.doesNotMatch(preview, /! Conflict: \/example\/target/);
  assert.doesNotMatch(preview, /\u001b\[/);
  flow.preview(plan, 'update');
  assert.match(preview, /Then re-run update/);
  assert.doesNotMatch(preview, /To remove other items first/);
});

test('progress follows the real operation, finishes before usage guidance, and stops on failure', async () => {
  const events: string[] = [];
  const flow = new InteractiveFlow({ ...prompts,
    bar: () => ({
      start: message => { events.push(`start: ${message}`); },
      update: fraction => { events.push(`update: ${fraction}`); },
      stop: message => { events.push(`success: ${message}`); },
      error: message => { events.push(`error: ${message}`); },
    }),
    note: (_message, title) => { events.push(`note: ${title}`); },
    outro: message => { events.push(`outro: ${message}`); },
  });
  const plan = progressPlan();
  let release!: () => void;
  const operation = new Promise<void>(resolve => { release = resolve; });
  const applying = flow.apply('install', plan, () => operation, 0);
  assert.deepEqual(events, ['start: Installing selected items', 'update: 1']);
  release();
  await applying;
  flow.complete('install', plan, 'project', '/example/project', ['skill/bdv-explain-code']);
  assert.deepEqual(events, [
    'start: Installing selected items', 'update: 1', `success: ${completionSummary('install', plan)}`,
    'note: Next step', 'outro: Ready to use.',
  ]);
  events.length = 0;
  const failure = new Error('write failed');
  await assert.rejects(flow.apply('install', plan, async () => { throw failure; }, 0), error => error === failure);
  assert.deepEqual(events, ['start: Installing selected items', 'update: 1', 'error: Could not apply changes']);
});

test('flag-driven installs, updates, uninstalls and limitation gates still work without prompts', async t => {
  const dir = await temporary(t);
  const cli = path.resolve('dist/tool/src/cli.js');
  for (const id of adapterIds) {
    for (const scope of ['project', 'global']) {
      const base = path.join(dir, `${id}-${scope}`);
      await mkdir(base);
      const env = { ...process.env, HOME: base };
      const flags = ['--agent', id, '--scope', scope, '--project', base, '--only', 'skill/bdv-explain-code', '--yes'];
      const context = await targetContext(scope, base, base, id);
      if (id === 'opencode') {
        const rejected = spawnSync(process.execPath, [cli, 'install', ...flags], { env, encoding: 'utf8' });
        assert.equal(rejected.status, 1);
        assert.match(rejected.stderr, /--accept-limitations/);
        assert.equal(await readManifest(context), null);
      }
      flags.push('--accept-limitations');
      const preview = execFileSync(process.execPath, [cli, 'install', ...flags, '--dry-run'], { env, encoding: 'utf8' });
      assert.match(preview, /create /);
      assert.equal(await readManifest(context), null);
      const installed = execFileSync(process.execPath, [cli, 'install', ...flags], { env, encoding: 'utf8' });
      assert.match(installed, /install complete/);
      assert.doesNotMatch(installed, /\u001b\[/);
      const manifest = (await readManifest(context))!;
      assert.deepEqual([...new Set(manifest.files.map(f => f.asset))], ['skill/bdv-explain-code']);
      assert.ok(await readFile(path.join(context.target, manifest.files[0]!.path)));
      assert.match(execFileSync(process.execPath, [cli, 'update', ...flags], { env, encoding: 'utf8' }), /update complete/);
      assert.match(execFileSync(process.execPath, [cli, 'uninstall', ...flags], { env, encoding: 'utf8' }), /uninstall complete/);
      assert.equal((await readManifest(context))!.files.length, 0);
    }
  }
});

test('flag-driven conflicts explain how to resolve them without changing files or state in either scope', async t => {
  const dir = await temporary(t);
  const cli = path.resolve('dist/tool/src/cli.js');
  const editedAsset = 'skill/bdv-explain-code';
  const otherAsset = 'skill/bdv-grill-me';
  for (const id of adapterIds) {
    for (const scope of ['project', 'global']) {
      const base = path.join(dir, `${id}-${scope}`);
      await mkdir(base);
      const env = { ...process.env, HOME: base };
      const flags = ['--agent', id, '--scope', scope, '--project', base, '--yes', '--accept-limitations'];
      const selection = ['--only', editedAsset, '--only', otherAsset];
      const run = (command: string, ...extra: string[]) => spawnSync(process.execPath, [cli, command, ...flags, ...extra],
        { env, encoding: 'utf8' });
      const context = await targetContext(scope, base, base, id);
      const editedPath = 'skills/bdv-explain-code/SKILL.md';
      const destination = path.join(context.target, editedPath);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, 'existing unmanaged file');
      const unmanaged = run('install', ...selection);
      assert.equal(unmanaged.status, 1, unmanaged.stderr);
      assert.match(unmanaged.stdout, /existing file is not managed/);
      assert.match(unmanaged.stdout, /Move this file outside the target directory/);
      assert.ok(unmanaged.stdout.includes(`! Conflict: ${editedPath}`));
      assert.match(unmanaged.stderr, /install blocked by conflicts\. No files changed\./);
      assert.equal(await readManifest(context), null);
      assert.equal(await readFile(destination, 'utf8'), 'existing unmanaged file');
      await assert.rejects(readFile(path.join(context.target, 'skills/bdv-grill-me/SKILL.md')), { code: 'ENOENT' });
      await rm(destination);
      const installed = run('install', ...selection);
      assert.equal(installed.status, 0, installed.stderr);
      await writeFile(destination, 'my edits');
      const manifestBytes = await readFile(context.manifest);
      const manifest = (await readManifest(context))!;
      const contents = await Promise.all(manifest.files.map(file => readFile(path.join(context.target, file.path))));
      for (const command of ['install', 'update', 'uninstall']) {
        const rejected = run(command, ...selection);
        assert.equal(rejected.status, 1, rejected.stderr);
        assert.match(rejected.stdout, /Modified since installation/);
        assert.match(rejected.stdout, /move this file outside the target directory/);
        assert.ok(rejected.stdout.includes(`Item: ${editedAsset}`));
        assert.ok(rejected.stdout.includes(`! Conflict: ${editedPath}`));
        assert.ok(rejected.stdout.includes(`Then re-run ${command}.`));
        assert.ok(rejected.stderr.includes(`${command} blocked by conflicts. No files changed.`));
        assert.doesNotMatch(rejected.stdout, /\u001b\[/);
        assert.deepEqual(await readFile(context.manifest), manifestBytes);
        for (const [index, file] of manifest.files.entries()) {
          assert.deepEqual(await readFile(path.join(context.target, file.path)), contents[index]);
        }
        await assert.rejects(readFile(`${context.manifest}.journal`), { code: 'ENOENT' });
      }
      const preview = run('update', ...selection, '--dry-run');
      assert.equal(preview.status, 1);
      assert.match(preview.stdout, /Modified since installation/);
      assert.deepEqual(await readFile(context.manifest), manifestBytes);
      const partial = run('uninstall', '--only', otherAsset);
      assert.equal(partial.status, 0, partial.stderr);
      assert.ok((await readManifest(context))!.files.every(file => file.asset === editedAsset));
      assert.equal(await readFile(destination, 'utf8'), 'my edits');
      const preserved = path.join(base, 'preserved-edits.md');
      await rename(destination, preserved);
      const retry = run('uninstall', '--only', editedAsset);
      assert.equal(retry.status, 0, retry.stderr);
      assert.equal((await readManifest(context))!.files.length, 0);
      assert.equal(await readFile(preserved, 'utf8'), 'my edits');
    }
  }
});
