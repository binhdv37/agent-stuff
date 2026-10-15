import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import * as prompts from '@clack/prompts';
import { loadCatalog } from '../core/src/index.js';
import { getAdapter, adapterIds } from '../adapters/index.js';
import { Cancelled, InteractiveFlow, completionSummary, formatCompatibility, formatPreview, validateProject } from '../tool/src/prompts.js';
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

test('verbose compatibility includes every field reason and effect within the terminal width', async () => {
  const catalog = await loadCatalog('core');
  const adapter = getAdapter('opencode');
  const results = ['skill/bdv-handoff', 'skill/bdv-explain-code'].map(key => adapter.check(catalog.get(key)!, catalog));
  const formatted = formatCompatibility(results, 60, true);
  const normalized = formatted.replace(/\s+/g, ' ');
  assert.ok(formatted.split('\n').every(line => line.length <= 60));
  assert.doesNotMatch(formatted, /\u001b\[/);
  for (const result of results) {
    assert.ok(normalized.includes(`Limited: ${result.asset}`));
    for (const issue of result.issues) {
      assert.ok(normalized.includes(`${issue.field} [${issue.status}]: ${issue.reason}`));
      assert.ok(normalized.includes(`Effect: ${issue.effect}`));
    }
  }
  let seen = '';
  const flow = new InteractiveFlow({ ...prompts, bar: noopBar,
    note: message => { seen = message ?? ''; },
  });
  for (const verbose of [false, true]) {
    flow.compatibility(results, verbose);
    assert.equal(seen, formatCompatibility(results, (process.stdout.columns ?? 100) - 6, verbose));
  }
});

test('previews summarize file actions by destination, with relative individual files only in verbose mode', () => {
  const changes: Change[] = [
    { asset: 'skill/one', path: 'skills/one/SKILL.md', action: 'create', content: null, before: null },
    { asset: 'skill/one', path: 'skills/one/references/example.md', action: 'create', content: null, before: null },
    { asset: 'skill/two', path: 'skills/two/SKILL.md', action: 'update', content: null, before: null },
    { asset: 'skill/two', path: 'skills/two/old.md', action: 'remove', content: null, before: null },
    { asset: 'command/one', path: 'commands/one.md', action: 'unchanged', content: null, before: null },
    { asset: 'agent/one', path: 'config.toml', action: 'update', content: null, before: null },
  ];
  const plan = { context: { target: '/example/target' }, changes } as Plan;
  let seen = '';
  const flow = new InteractiveFlow({ ...prompts, bar: noopBar,
    note: message => { seen = message ?? ''; },
  });
  const compact = formatPreview(plan, 'install');
  assert.match(compact, /Files: 2 create · 2 update · 1 remove · 1 unchanged/);
  assert.match(compact, /skills\/: 2 create · 1 update · 1 remove/);
  assert.match(compact, /commands\/: 1 unchanged/);
  assert.match(compact, /\.\/: 1 update/);
  assert.match(compact, /--verbose/);
  for (const change of changes) assert.ok(!compact.includes(change.path));
  for (const verbose of [false, true]) {
    const formatted = formatPreview(plan, 'install', verbose);
    flow.preview(plan, 'install', verbose);
    assert.equal(seen, formatted);
    assert.doesNotMatch(formatted, /\u001b\[/);
    if (verbose) {
      for (const change of changes) {
        assert.ok(formatted.includes(`${change.action}  ${change.path}`));
        assert.ok(!formatted.includes(`/example/target/${change.path}`));
      }
    }
  }
  assert.equal(formatPreview({ ...plan, changes: [] }, 'update'), 'Target: /example/target\nFiles: no changes');
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

test('compact and verbose previews explain every conflict cause with relative paths and concrete next steps', () => {
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
  const plan = { context: { target: '/example/target' }, changes: [...changes,
    { asset: 'skill/other', path: 'skills/other/SKILL.md', action: 'create', content: null, before: null },
  ] } as Plan;
  for (const verbose of [false, true]) {
    flow.preview(plan, 'uninstall', verbose);
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
      assert.equal(preview.split(`! Conflict: ${change.path}`).length - 1, 1);
      assert.ok(preview.includes(`Item: ${change.asset}`));
    }
    assert.doesNotMatch(preview, /! Conflict: \/example\/target/);
    assert.doesNotMatch(preview, /\u001b\[/);
    flow.preview(plan, 'update', verbose);
    assert.match(preview, /Then re-run update/);
    assert.doesNotMatch(preview, /To remove other items first/);
  }
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
        assert.doesNotMatch(rejected.stdout, /^(create|update|remove|unchanged) /m);
        assert.equal(await readManifest(context), null);
        const unacceptedPreview = spawnSync(process.execPath, [cli, 'install', ...flags, '--dry-run'], { env, encoding: 'utf8' });
        assert.equal(unacceptedPreview.status, 0, unacceptedPreview.stderr);
        assert.match(unacceptedPreview.stdout, /Files: \d+ create/);
        assert.equal(await readManifest(context), null);
      }
      flags.push('--accept-limitations');
      const preview = execFileSync(process.execPath, [cli, 'install', ...flags, '--dry-run'], { env, encoding: 'utf8' });
      assert.match(preview, /Files: \d+ create/);
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

test('CLI compact and verbose previews show compatibility once and leave targets untouched for every harness', async t => {
  const dir = await temporary(t);
  const cli = path.resolve('dist/tool/src/cli.js');
  const catalog = await loadCatalog('tests/fixtures/core');
  const selected = ['skill/bdv-handoff', 'skill/bdv-api-handoff'].map(key => catalog.get(key)!);
  for (const id of adapterIds) {
    const adapter = getAdapter(id);
    const results = selected.map(asset => adapter.check(asset, catalog));
    const files = selected.flatMap(asset => adapter.render(asset, catalog));
    const flags = ['--agent', id, '--scope', 'project', '--project', dir, '--source', path.resolve('tests/fixtures'),
      ...selected.flatMap(asset => ['--only', asset.key]), '--dry-run'];
    for (const verbose of [false, true]) {
      const env: NodeJS.ProcessEnv = { ...process.env, HOME: dir };
      delete env.NO_COLOR;
      if (verbose) env.NO_COLOR = '1';
      const result = spawnSync(process.execPath, [cli, 'install', ...flags, ...(verbose ? ['--verbose'] : [])],
        { env, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.split('Compatibility\n').length - 1, 1);
      const [compatibility, preview] = result.stdout.split('Review changes\n');
      const normalized = compatibility!.replace(/\s+/g, ' ');
      for (const checked of results) {
        assert.ok(normalized.includes(checked.asset));
        for (const issue of checked.issues) {
          assert.ok(normalized.includes(issue.field));
          assert.ok(normalized.includes(issue.effect));
          if (verbose) assert.ok(normalized.includes(issue.reason));
          else assert.equal(normalized.split(issue.effect).length - 1, 1);
        }
      }
      assert.match(preview!, new RegExp(`Files: ${files.length} create`));
      assert.match(preview!, /skills\//);
      for (const file of files) assert.equal(preview!.includes(`create  ${file.path}`), verbose);
      assert.doesNotMatch(result.stdout + result.stderr, /\u001b\[/);
      assert.deepEqual(await readdir(dir), []);
    }
  }
  assert.match(execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' }), /--verbose.*individual files/);
});

test('CLI argument and selection errors name the cause, give a fix, and never mutate the target', async t => {
  const dir = await temporary(t);
  const cli = path.resolve('dist/tool/src/cli.js');
  const file = path.join(dir, 'not-directory');
  await writeFile(file, 'preserve me');
  const target = ['--scope', 'project', '--project', dir, '--yes'];
  const flags = ['--agent', 'claude-code', ...target];
  const cases: { name: string; args: string[]; patterns: RegExp[]; absent?: RegExp }[] = [
    { name: 'missing project', args: ['--agent', 'claude-code', '--scope', 'project', '--project', path.join(dir, 'missing'), '--yes'],
      patterns: [/Project directory not found:/, /Pass an existing directory with --project/] },
    { name: 'file project', args: ['--agent', 'claude-code', '--scope', 'project', '--project', file, '--yes'],
      patterns: [/--project is not a directory:/, /Pass an existing directory/] },
    { name: 'missing scope', args: ['--agent', 'claude-code', '--project', dir, '--yes'],
      patterns: [/Missing required options for install: --scope/, /Pass --scope/] },
    { name: 'all missing options', args: [], patterns: [/--agent, --scope, --yes/, /Pass --agent and --scope and --yes/] },
    { name: 'missing project and confirmation', args: ['--agent', 'claude-code', '--scope', 'project'],
      patterns: [/--project, --yes/, /Pass --project and --yes/] },
    { name: 'unknown option', args: ['update', '--bogus'], patterns: [/Unknown option "--bogus"/, /Remove it/, /Usage: agent-stuff update/],
      absent: /positional argument starting with/ },
    { name: 'missing flag value', args: ['install', '--agent'], patterns: [/Missing or invalid value for --agent/, /Pass --agent <value>/] },
    { name: 'ambiguous flag value', args: ['--agent', '--yes'], patterns: [/Missing or invalid value for --agent/, /--agent=<value>/] },
    { name: 'value on switch', args: ['--yes=maybe'], patterns: [/--yes does not take a value/, /Pass --yes without/] },
    { name: 'value on verbose switch', args: ['--verbose=maybe'], patterns: [/--verbose does not take a value/, /Pass --verbose without/] },
    { name: 'unsupported explicit item', args: [...flags, '--only', 'agent/solution-architect'],
      patterns: [/unsupported assets for --agent claude-code: agent\/solution-architect/, /Remove the unsupported --only entries/, /--compatible-only/],
      absent: /use --only or --compatible-only/ },
    { name: 'missing kind prefix', args: [...flags, '--only', 'bdv-explain-code'],
      patterns: [/--only: "bdv-explain-code"/, /Did you mean skill\/bdv-explain-code or command\/bdv-explain-code\?/, /agent-stuff list/] },
    { name: 'typo', args: [...flags, '--only', 'skill/bdv-explan-code'],
      patterns: [/--only: "skill\/bdv-explan-code"/, /Did you mean skill\/bdv-explain-code\?/] },
    { name: 'unrelated item', args: [...flags, '--only', 'skill/zzzzzzzzzzzzzz'],
      patterns: [/Unknown item/, /full key with --only/], absent: /Did you mean/ },
    { name: 'informal harness name', args: ['--agent', 'claude', ...target],
      patterns: [/Unknown --agent value "claude"/, /Did you mean claude-code\?/, /Use --agent/], absent: /Unknown adapter/ },
    { name: 'invalid scope', args: ['--agent', 'claude-code', '--scope', 'local', '--yes'],
      patterns: [/Invalid --scope value "local"/, /Use --scope project or --scope global/] },
    { name: 'missing build output', args: ['build', '--agent', 'claude-code'],
      patterns: [/Missing required options for build: --out/, /Pass --out/] },
    { name: 'unknown command', args: ['instal'], patterns: [/Unknown command "instal"/, /Choose list/, /agent-stuff --help/] },
    { name: 'extra positional', args: ['install', 'bdv-explain-code'],
      patterns: [/Unexpected argument "bdv-explain-code"/, /select items with --only/] },
    { name: 'unaccepted limitations', args: [...flags, '--source', path.resolve('tests/fixtures'), '--only', 'skill/bdv-handoff'],
      patterns: [/No files changed/, /--accept-limitations/, /--yes alone does not accept limitations/] },
  ];
  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const result = spawnSync(process.execPath, [cli, ...scenario.args], { encoding: 'utf8', env: { ...process.env, HOME: dir } });
      assert.equal(result.status, 1, result.stderr);
      for (const pattern of scenario.patterns) assert.match(result.stderr, pattern);
      if (scenario.absent) assert.doesNotMatch(result.stderr, scenario.absent);
      assert.doesNotMatch(result.stderr, /ENOENT|ENOTDIR|Scope \(project\/global\):|ERR_PARSE_ARGS_|\n\s+at /);
      assert.doesNotMatch(result.stdout, /^(create|update|remove|unchanged) /m);
      assert.deepEqual(await readdir(dir), ['not-directory']);
      assert.equal(await readFile(file, 'utf8'), 'preserve me');
    });
  }
});

test('update and uninstall suggest installed keys without mutating installation state', async t => {
  const dir = await temporary(t);
  const cli = path.resolve('dist/tool/src/cli.js');
  const flags = ['--agent', 'claude-code', '--scope', 'project', '--project', dir, '--yes'];
  const run = (command: string, ...args: string[]) => spawnSync(process.execPath, [cli, command, ...flags, ...args],
    { encoding: 'utf8', env: { ...process.env, HOME: dir } });
  const installed = run('install', '--only', 'skill/bdv-explain-code');
  assert.equal(installed.status, 0, installed.stderr);
  const context = await targetContext('project', dir, dir, 'claude-code');
  const before = await readFile(context.manifest);
  const manifest = (await readManifest(context))!;
  const contents = await Promise.all(manifest.files.map(file => readFile(path.join(context.target, file.path))));
  for (const command of ['update', 'uninstall']) {
    const result = run(command, '--only', 'bdv-explain-code');
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Item is not installed in --only: "bdv-explain-code"/);
    assert.match(result.stderr, /Did you mean skill\/bdv-explain-code\?/);
    assert.deepEqual(await readFile(context.manifest), before);
    for (const [index, file] of manifest.files.entries()) {
      assert.deepEqual(await readFile(path.join(context.target, file.path)), contents[index]);
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
      if (id === 'opencode' && scope === 'project') {
        const withoutAcceptance = spawnSync(process.execPath, [cli, 'install', ...flags.filter(flag => flag !== '--accept-limitations'), ...selection],
          { env, encoding: 'utf8' });
        assert.equal(withoutAcceptance.status, 1);
        assert.match(withoutAcceptance.stdout, /existing file is not managed/);
        assert.match(withoutAcceptance.stderr, /install blocked by conflicts/);
        assert.equal(await readManifest(context), null);
        assert.equal(await readFile(destination, 'utf8'), 'existing unmanaged file');
      }
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
