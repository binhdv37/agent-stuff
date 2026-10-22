import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, cp, mkdir, writeFile, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { stringify } from 'yaml';
import { loadCatalog } from '../core/src/index.js';
import { fingerprint, inspect, ownerTestsSchema, report, type OwnerTest } from '../tool/src/verification/index.js';

async function temporary(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const source = await realpath(await mkdtemp(path.join(tmpdir(), 'agent-stuff-owner-tests-')));
  t.after(() => rm(source, { recursive: true, force: true }));
  await cp('core', path.join(source, 'core'), { recursive: true });
  await mkdir(path.join(source, 'verification'));
  await save(source, []);
  return source;
}

async function save(source: string, records: OwnerTest[]): Promise<void> {
  await writeFile(path.join(source, 'verification/owner-tests.yaml'), stringify({ schema_version: 1, records }));
}

async function recordAt(source: string): Promise<OwnerTest> {
  return { asset: 'skill/bdv-product-brief', harness: 'codex', scope: 'project', tested_on: '2026-10-01',
    result: 'works', fingerprint: fingerprint(await loadCatalog(path.join(source, 'core')), 'skill/bdv-product-brief', 'codex'),
    notes: 'Synthetic record for ledger tests only; not a real owner confirmation.' };
}

test('owner records are optional, strict, scoped, and reject ambiguous or invalid entries', async t => {
  const source = await temporary(t);
  assert.deepEqual(await inspect(source), []);
  assert.match(report([]), /Chưa có xác nhận/);
  const record = await recordAt(source);
  assert.equal(ownerTestsSchema.safeParse({ schema_version: 1, records: [record] }).success, true);
  for (const change of [{ tested_on: '2026-02-30' }, { result: 'passed' }, { fingerprint: 'unknown' },
    { harness: 'other' }, { scope: 'both' }, { notes: '' }, { cases: [] }]) {
    assert.equal(ownerTestsSchema.safeParse({ schema_version: 1, records: [{ ...record, ...change }] }).success, false);
  }
  await save(source, [record, record]);
  await assert.rejects(inspect(source), /Duplicate asset\/harness\/scope/);
  await save(source, [record, { ...record, scope: 'global' }]);
  assert.equal((await inspect(source)).length, 2);
  await save(source, [{ ...record, asset: 'skill/missing' }]);
  await assert.rejects(inspect(source), /Unknown asset/);
  const file = path.join(source, 'verification/owner-tests.yaml');
  await rm(file);
  await symlink(path.join(source, 'core/skills/bdv-product-brief/definition.yaml'), file);
  await assert.rejects(inspect(source), /Symlink not allowed/);
});

test('fingerprints track installed resources and declared dependencies rather than unrelated repository edits', async t => {
  const source = await temporary(t);
  const commandDirectory = path.join(source, 'core/commands/example');
  await mkdir(commandDirectory, { recursive: true });
  await writeFile(path.join(commandDirectory, 'definition.yaml'),
    'schema_version: 1\nkind: command\nid: example\ndescription: Test workflow reference\nworkflow: skill/bdv-grill-me\n');
  let catalog = await loadCatalog(path.join(source, 'core'));
  const skill = fingerprint(catalog, 'skill/bdv-product-brief', 'codex');
  const command = fingerprint(catalog, 'command/example', 'opencode');
  const agent = fingerprint(catalog, 'agent/experimental-plan', 'opencode');
  await writeFile(path.join(source, 'core/docs/format.md'), 'Unrelated authoring-document edit\n');
  await writeFile(path.join(source, 'package-lock.json'), 'Unrelated dependency change\n');
  assert.equal(fingerprint(await loadCatalog(path.join(source, 'core')), 'skill/bdv-product-brief', 'codex'), skill);
  await writeFile(path.join(source, 'core/skills/bdv-product-brief/assets/product-brief.md'), 'Changed resource\n');
  await writeFile(path.join(source, 'core/skills/bdv-grill-me/instructions.md'), 'Changed workflow\n');
  await writeFile(path.join(source, 'core/agents/bdv-plan-reviewer/instructions.md'), 'Changed delegate\n');
  catalog = await loadCatalog(path.join(source, 'core'));
  assert.notEqual(fingerprint(catalog, 'skill/bdv-product-brief', 'codex'), skill);
  assert.notEqual(fingerprint(catalog, 'command/example', 'opencode'), command);
  assert.notEqual(fingerprint(catalog, 'agent/experimental-plan', 'opencode'), agent);
  assert.throws(() => fingerprint(catalog, 'skill/missing', 'codex'), /Unknown asset/);
  assert.throws(() => fingerprint(catalog, 'agent/bdv-reviewer', 'codex'), /unsupported mapping/);
});

test('changed output and unsupported mappings do not rewrite owner history or imply a fresh success', async t => {
  const source = await temporary(t);
  const record = await recordAt(source);
  await save(source, [record]);
  const original = await readFile(path.join(source, 'verification/owner-tests.yaml'), 'utf8');
  assert.equal((await inspect(source))[0]!.stale, false);
  await writeFile(path.join(source, 'core/skills/bdv-product-brief/instructions.md'), 'Changed instructions\n');
  const row = (await inspect(source))[0]!;
  assert.equal(row.result, 'works');
  assert.equal(row.tested_on, record.tested_on);
  assert.equal(row.stale, true);
  assert.match(report([row]), /Changed since test/);
  assert.equal(await readFile(path.join(source, 'verification/owner-tests.yaml'), 'utf8'), original);
  await save(source, [{ ...record, result: 'has-issues', notes: 'Review | needs work\n<script>' },
    { ...record, asset: 'agent/bdv-reviewer', result: 'needs-retest' }]);
  const rows = await inspect(source);
  assert.equal(rows[1]!.compatibility, 'unsupported');
  assert.equal(rows[1]!.stale, true);
  const markdown = report(rows);
  assert.match(markdown, /Has issues/);
  assert.match(markdown, /Needs retest \| unsupported \| Unavailable/);
  assert.match(markdown, /Review &#124; needs work &lt;script&gt;/);
  const catalog = await loadCatalog(path.join(source, 'core'));
  await save(source, [{ ...record, asset: 'agent/experimental-plan', harness: 'opencode',
    fingerprint: fingerprint(catalog, 'agent/experimental-plan', 'opencode') }]);
  const helperDefinition = path.join(source, 'core/agents/bdv-plan-reviewer/definition.yaml');
  await writeFile(helperDefinition, (await readFile(helperDefinition, 'utf8')) + '\nresources: [extra.md]\n');
  await writeFile(path.join(source, 'core/agents/bdv-plan-reviewer/extra.md'), 'Unsupported agent resource\n');
  assert.equal((await inspect(source))[0]!.compatibility, 'unsupported');
  assert.equal((await inspect(source))[0]!.stale, true);
});

test('verification CLI validates owner data and checks summaries without a model-behavior gate', async t => {
  const source = await temporary(t);
  const cli = path.resolve('dist/tool/src/verification/cli.js');
  const run = (...args: string[]) => execFileSync(process.execPath, [cli, ...args, '--source', source], { encoding: 'utf8', stdio: 'pipe' });
  assert.match(run('validate'), /Validated 0 owner-testing records/);
  const record = await recordAt(source);
  assert.deepEqual(JSON.parse(run('fingerprint', '--asset', record.asset, '--harness', record.harness)), { fingerprint: record.fingerprint });
  await save(source, [record]);
  assert.match(run('validate'), /Validated 1 owner-testing records/);
  run('report');
  assert.match(run('report', '--check'), /summary is current/);
  const ledger = await readFile(path.join(source, 'verification/owner-tests.yaml'), 'utf8');
  await writeFile(path.join(source, 'core/skills/bdv-product-brief/instructions.md'), 'Changed after owner use\n');
  assert.throws(() => run('report', '--check'), /summary is out of date/);
  assert.match(run('validate'), /Validated 1 owner-testing records/);
  run('report');
  assert.match(await readFile(path.join(source, 'verification/README.md'), 'utf8'), /Changed since test/);
  for (const args of [['validate', '--require-passed'], ['fingerprint', '--asset', 'skill/missing', '--harness', 'codex'],
    ['fingerprint', '--asset', record.asset, '--harness', 'unknown'], ['validate', '--asset', record.asset]]) {
    assert.throws(() => run(...args));
  }
  assert.equal(await readFile(path.join(source, 'verification/owner-tests.yaml'), 'utf8'), ledger);
});
