import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import * as prompts from '@clack/prompts';
import { loadCatalog } from '../core/src/index.js';
import { getAdapter, adapterIds } from '../adapters/index.js';
import { Cancelled, InteractiveFlow, completionSummary, formatCompatibility, validateProject } from '../tool/src/prompts.js';
import { readManifest, targetContext, type Plan } from '../tool/src/installation/index.js';

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
