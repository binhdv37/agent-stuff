import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, realpath, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getContract, getDocs, loadCatalog, CoreError, type DocsTopic } from '../core/src/index.js';
import { definitionSchema } from '../tool/src/core/schema.js';

test('public contract covers every schema field including nested policy, without extra fields', () => {
  const contract = getContract();
  assert.equal(contract.contractVersion, 1);
  assert.equal(contract.definitionSchemaVersion, 1);
  assert.doesNotThrow(() => JSON.stringify(contract));
  for (const validator of definitionSchema.options) {
    const kind = validator.shape.kind.value;
    const expected = Object.keys(validator.shape);
    if (kind === 'agent') {
      const agent = definitionSchema.options.find(s => s.shape.kind.value === 'agent')!;
      if ('policy' in agent.shape) expected.push(...Object.keys(agent.shape.policy.shape).map(key => `policy.${key}`));
    }
    assert.deepEqual(Object.keys(contract.kinds[kind].fields).sort(), expected.sort());
    for (const meaning of Object.values(contract.kinds[kind].fields)) assert.ok(meaning.description.trim());
  }
  const skill = contract.kinds.skill.schema;
  assert.equal(skill.additionalProperties, false);
  assert.equal(skill.properties!.activation!.default, 'explicit');
  assert.ok(!skill.required!.includes('activation'));
  const policy = contract.kinds.agent.schema.properties!.policy!;
  assert.equal(policy.additionalProperties, false);
  assert.equal(policy.properties!.workspace_write!.default, 'deny');
});

test('public snapshots cannot mutate later contract/docs results', () => {
  const first = getContract();
  first.kinds.skill.fields.activation!.description = 'changed';
  first.kinds.skill.schema.properties!.activation!.default = 'changed';
  first.rules.length = 0;
  const next = getContract();
  assert.match(next.kinds.skill.fields.activation!.description, /explicit/);
  assert.equal(next.kinds.skill.schema.properties!.activation!.default, 'explicit');
  assert.ok(next.rules.length);
  assert.match(getDocs('fields'), /\| activation \| explicit \/ matching-request \| không \| "explicit"/);
  for (const topic of ['concepts', 'format', 'api'] as const) assert.match(getDocs(topic), /^# /);
  assert.throws(() => getDocs('toString' as DocsTopic), (error: unknown) =>
    error instanceof CoreError && error.code === 'UNKNOWN_DOCS_TOPIC');
});

test('public loader reads a standalone core root and rejects invalid content with contextual errors', async t => {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'agent-stuff-contract-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const coreRoot = path.join(directory, 'independent-catalog');
  await cp('tests/fixtures/core', coreRoot, { recursive: true });
  const catalog = await loadCatalog(coreRoot);
  assert.equal(catalog.size, 7);
  const skill = catalog.get('skill/bdv-teach')!;
  assert.equal(skill.resources.size, 4);
  assert.equal(skill.definition.kind, 'skill');
  if (skill.definition.kind === 'skill') assert.equal(skill.definition.activation, 'explicit');
  await assert.rejects(loadCatalog(directory), (error: unknown) =>
    error instanceof CoreError && error.code === 'CATALOG_INVALID' && /No assets/.test(error.message));
  const command = path.join(coreRoot, 'commands/bdv-change-report/definition.yaml');
  await writeFile(command, 'schema_version: 1\nkind: command\nid: bdv-change-report\ndescription: Example\nworkflow: skill/missing\n');
  await assert.rejects(loadCatalog(coreRoot), (error: unknown) =>
    error instanceof CoreError && error.code === 'CATALOG_INVALID' &&
    /command\/bdv-change-report: missing workflow/.test(error.message) && error.cause instanceof Error);
});

test('public loader preserves strict validation and resource path protection', async t => {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'agent-stuff-contract-invalid-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp('tests/fixtures/core', directory, { recursive: true });
  const definition = path.join(directory, 'skills/bdv-teach/definition.yaml');
  await writeFile(definition, 'schema_version: 1\nkind: skill\nid: bdv-teach\ndescription: Example\ninstructions: ../outside.md\n');
  await assert.rejects(loadCatalog(directory), /normalized relative path/);
  await writeFile(definition, 'schema_version: 1\nkind: skill\nid: bdv-teach\ndescription: Example\ninstructions: instructions.md\nunknown_behavior: true\n');
  await assert.rejects(loadCatalog(directory), /Unrecognized key/);
  await cp('tests/fixtures/core/skills/bdv-teach/definition.yaml', definition);
  const resource = path.join(directory, 'skills/bdv-teach/GLOSSARY-FORMAT.md');
  await rm(resource);
  await symlink(path.join(directory, 'skills/bdv-teach/MISSION-FORMAT.md'), resource);
  await assert.rejects(loadCatalog(directory), /Symlink not allowed/);
});
