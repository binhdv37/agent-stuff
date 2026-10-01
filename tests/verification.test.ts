import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, cp, mkdir, writeFile, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { stringify } from 'yaml';
import { loadCore } from '../tool/src/core/load.js';
import { fingerprint, inspect, recordSchema, report, sha256, statusOf, type Record } from '../tool/src/verification/index.js';

async function temporary(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'agent-stuff-verification-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp('core', path.join(directory, 'core'), { recursive: true });
  await cp('tool/src', path.join(directory, 'tool/src'), { recursive: true });
  await cp('adapters', path.join(directory, 'adapters'), { recursive: true });
  await cp('package-lock.json', path.join(directory, 'package-lock.json'));
  return directory;
}

async function recordAt(source: string): Promise<Record> {
  const catalog = await loadCore(source);
  const evidencePath = 'evidence/skill/bdv-api-handoff/codex/latest.md';
  const bytes = 'Synthetic evidence for verification infrastructure tests only.\n';
  const artifact = path.join(source, 'docs/verification', evidencePath);
  await mkdir(path.dirname(artifact), { recursive: true });
  await writeFile(artifact, bytes);
  return recordSchema.parse({
    schema_version: 1, asset: 'skill/bdv-api-handoff', harness: 'codex',
    checked_at: '2026-10-01T01:00:00Z',
    fingerprint: await fingerprint(source, catalog, 'skill/bdv-api-handoff', 'codex'),
    environment: { harness_version: 'test-binary', adapter_revision: 1, model: 'test-model',
      scopes: ['project'], platform: 'test-platform', configuration: 'Isolated test fixture; no real model run' },
    contract: 'Test the verification ledger itself', limitations: [],
    cases: ['core', 'render-install', 'discovery', 'behavior'].map((stage, index) => ({
      id: `case-${index}`, stage, required: true, procedure: 'Synthetic infrastructure test',
      expected: 'Fixture accepted', observed: 'Fixture accepted', outcome: 'passed',
      evidence: [{ path: evidencePath, sha256: sha256(bytes) }],
    })),
  });
}

async function save(source: string, record: Record): Promise<void> {
  const destination = path.join(source, `docs/verification/${record.asset}/${record.harness}.yaml`);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, stringify(record));
}

test('verification matrix includes missing and unsupported targets without inventing passes', async t => {
  const source = await temporary(t);
  const rows = await inspect(source);
  assert.equal(rows.length, 48);
  assert.ok(rows.every(row => row.status === 'not-tested' && row.checkedAt === null));
  assert.equal(rows.find(row => row.asset === 'agent/experimental-plan' && row.harness === 'codex')!.compatibility, 'unsupported');
  assert.match(report(rows), /Not tested: 48/);
});

test('results are derived from cases and a newer blocked run replaces a previous pass', async t => {
  const source = await temporary(t);
  const record = await recordAt(source);
  await save(source, record);
  let row = (await inspect(source)).find(row => row.asset === record.asset && row.harness === record.harness)!;
  assert.equal(row.status, 'passed');
  assert.equal(row.stale, false);
  record.cases[3]!.outcome = 'blocked';
  record.cases[3]!.observed = 'Model inference could not run';
  record.checked_at = '2026-10-01T02:00:00Z';
  await save(source, record);
  row = (await inspect(source)).find(row => row.asset === record.asset && row.harness === record.harness)!;
  assert.equal(row.status, 'blocked');
  assert.equal(row.checkedAt, record.checked_at);
  assert.ok(row.issues.some(issue => issue.includes('Model inference could not run')));
  record.cases[0]!.outcome = 'failed';
  assert.equal(statusOf(record), 'failed');
  record.cases = record.cases.slice(0, 3).map(c => ({ ...c, outcome: 'passed' }));
  assert.equal(statusOf(record), 'partial');
});

test('verification rejects unsubstantiated outcomes, changed evidence, wrong identity and unsafe references', async t => {
  const source = await temporary(t);
  const record = await recordAt(source);
  const noEvidence = structuredClone(record);
  noEvidence.cases[0]!.evidence = [];
  assert.equal(recordSchema.safeParse(noEvidence).success, false);
  assert.equal(recordSchema.safeParse({ ...record, checked_at: null }).success, false);
  assert.equal(recordSchema.safeParse({ ...record, status: 'passed' }).success, false);
  await save(source, { ...record, environment: { ...record.environment, model: null } });
  await assert.rejects(inspect(source), /requires harness version and model/);
  await save(source, record);
  const artifact = path.join(source, 'docs/verification', record.cases[0]!.evidence[0]!.path);
  await writeFile(artifact, 'Replaced evidence');
  await assert.rejects(inspect(source), /hash mismatch/);
  record.cases[0]!.evidence[0]!.path = '../outside';
  assert.equal(recordSchema.safeParse(record).success, false);
  const fresh = await recordAt(source);
  await save(source, { ...fresh, asset: 'skill/missing' });
  await assert.rejects(inspect(source), /Unknown asset/);
  await rm(path.join(source, 'docs/verification/skill/missing'), { recursive: true });
  await save(source, fresh);
  await rm(artifact);
  await symlink(path.join(source, 'package-lock.json'), artifact);
  await assert.rejects(inspect(source), /Symlink not allowed/);
});

test('complete cases cannot mark a currently unsupported mapping as passed', async t => {
  const source = await temporary(t);
  const record = await recordAt(source);
  const catalog = await loadCore(source);
  record.asset = 'agent/experimental-plan';
  record.fingerprint = await fingerprint(source, catalog, record.asset, record.harness);
  const evidencePath = 'evidence/agent/experimental-plan/codex/latest.md';
  const artifact = path.join(source, 'docs/verification', evidencePath);
  await mkdir(path.dirname(artifact), { recursive: true });
  await writeFile(artifact, await readFile(path.join(source, 'docs/verification', record.cases[0]!.evidence[0]!.path)));
  for (const c of record.cases) c.evidence[0]!.path = evidencePath;
  await save(source, record);
  await assert.rejects(inspect(source), /Cannot pass an unsupported mapping/);
});

test('fingerprints cover resources, command workflows, delegated agents and implementation changes', async t => {
  const source = await temporary(t);
  let catalog = await loadCore(source);
  const skill = await fingerprint(source, catalog, 'skill/bdv-api-handoff', 'codex');
  const command = await fingerprint(source, catalog, 'command/bdv-change-report', 'opencode');
  const agent = await fingerprint(source, catalog, 'agent/experimental-plan', 'opencode');
  await writeFile(path.join(source, 'core/skills/bdv-api-handoff/references/handoff-template.md'), 'Changed resource');
  await writeFile(path.join(source, 'core/skills/bdv-change-report/instructions.md'), 'Changed workflow');
  await writeFile(path.join(source, 'core/agents/bdv-plan-reviewer/instructions.md'), 'Changed helper');
  catalog = await loadCore(source);
  assert.notEqual((await fingerprint(source, catalog, 'skill/bdv-api-handoff', 'codex')).core, skill.core);
  assert.notEqual((await fingerprint(source, catalog, 'command/bdv-change-report', 'opencode')).core, command.core);
  assert.notEqual((await fingerprint(source, catalog, 'agent/experimental-plan', 'opencode')).core, agent.core);
  const record = await recordAt(source);
  await save(source, record);
  await writeFile(path.join(source, 'adapters/codex/index.ts'), '// changed implementation\n');
  const row = (await inspect(source)).find(row => row.asset === record.asset && row.harness === record.harness)!;
  assert.equal(row.stale, true);
  assert.match(report([row]), /Passed \(Stale\)/);
});

test('verification CLI checks the summary and refuses unverified completion targets', async t => {
  const source = await temporary(t);
  const cli = path.resolve('dist/tool/src/verification/cli.js');
  const run = (...args: string[]) => execFileSync(process.execPath, [cli, ...args, '--source', source], { encoding: 'utf8', stdio: 'pipe' });
  assert.match(run('validate'), /48 asset\/harness pairs/);
  assert.throws(() => run('validate', '--require-passed', '--asset', 'skill/bdv-api-handoff', '--harness', 'codex'), /Target is not currently verified/);
  const record = await recordAt(source);
  await save(source, record);
  run('validate', '--require-passed', '--asset', record.asset, '--harness', record.harness);
  run('report');
  assert.match(run('report', '--check'), /summary is current/);
  const summary = path.join(source, 'docs/verification/README.md');
  await writeFile(summary, (await readFile(summary, 'utf8')) + 'Manual edit\n');
  assert.throws(() => run('report', '--check'), /summary is out of date/);
  await writeFile(path.join(source, 'core/skills/bdv-api-handoff/instructions.md'), 'Changed content');
  assert.throws(() => run('validate', '--require-passed', '--asset', record.asset, '--harness', record.harness), /Target is not currently verified/);
});
