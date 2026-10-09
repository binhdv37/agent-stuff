import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { adapterIds, type AdapterId } from '../adapter.js';
import { loadCatalog, selectAssets, assertNoSymlinks, inside, relativePath, type Asset } from '../../../core/src/index.js';
import { getAdapter } from '../registry.js';

const nonempty = z.string().trim().min(1);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const stage = z.enum(['core', 'render-install', 'discovery', 'behavior']);
const stages = stage.options;
const outcome = z.enum(['passed', 'failed', 'blocked', 'not-run']);
export const recordSchema = z.strictObject({
  schema_version: z.literal(1),
  asset: z.string().regex(/^(skill|agent|command)\/[a-z0-9]+(-[a-z0-9]+)*$/),
  harness: z.enum(adapterIds),
  checked_at: z.iso.datetime({ offset: true }).nullable(),
  fingerprint: z.strictObject({ core: digest, implementation: digest }),
  environment: z.strictObject({
    harness_version: nonempty.nullable(), adapter_revision: z.number().int().positive(),
    model: nonempty.nullable(), scopes: z.array(z.enum(['project', 'global'])).min(1),
    platform: nonempty, configuration: nonempty,
  }),
  contract: nonempty,
  cases: z.array(z.strictObject({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), stage, required: z.boolean(),
    procedure: nonempty, expected: nonempty, observed: nonempty, outcome,
    evidence: z.array(z.strictObject({ path: relativePath, sha256: digest })),
  })),
  limitations: z.array(nonempty),
}).superRefine((record, ctx) => {
  const ids = record.cases.map(c => c.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Duplicate case ID' });
  const attempted = record.cases.some(c => c.outcome !== 'not-run');
  if (attempted !== (record.checked_at !== null)) {
    ctx.addIssue({ code: 'custom', message: 'checked_at must identify the latest attempted run; null only before testing' });
  }
  for (const c of record.cases) {
    if (c.outcome !== 'not-run' && !c.evidence.length) {
      ctx.addIssue({ code: 'custom', message: `Case ${c.id} requires evidence for its outcome` });
    }
    if (c.outcome === 'not-run' && c.evidence.length) {
      ctx.addIssue({ code: 'custom', message: `Unrun case ${c.id} cannot cite evidence` });
    }
  }
});
export type Record = z.infer<typeof recordSchema>;
export type Status = 'not-tested' | 'passed' | 'failed' | 'blocked' | 'partial';
export const sha256 = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');

export function statusOf(record: Record): Status {
  if (!record.cases.some(c => c.outcome !== 'not-run')) return 'not-tested';
  // A failing optional case is still visible: it must not disappear behind green required cases.
  if (record.cases.some(c => c.outcome === 'failed')) return 'failed';
  if (record.cases.some(c => c.outcome === 'blocked')) return 'blocked';
  const required = record.cases.filter(c => c.required);
  return stages.every(s => required.some(c => c.stage === s)) && required.every(c => c.outcome === 'passed')
    ? 'passed' : 'partial';
}

const implementationFiles = [
  'tool/src/adapter.ts', 'tool/src/render.ts', 'tool/src/registry.ts', 'tool/src/cli.ts',
  'core/src/index.ts', 'core/src/contract.ts', 'core/src/schema.ts',
  'core/src/catalog.ts', 'core/src/paths.ts',
  'tool/src/installation/index.ts', 'package-lock.json',
];

export async function fingerprint(source: string, catalog: Map<string, Asset>, key: string, harness: AdapterId): Promise<Record['fingerprint']> {
  const closure = new Map<string, Asset>();
  function visit(asset: Asset): void {
    if (closure.has(asset.key)) return;
    closure.set(asset.key, asset);
    if (asset.definition.kind === 'command') visit(catalog.get(asset.definition.workflow)!);
    if (asset.definition.kind === 'agent') {
      for (const target of asset.definition.policy.delegation_targets) visit(catalog.get(target)!);
    }
  }
  for (const asset of selectAssets(catalog, [key])) visit(asset);
  const content: [string, string][] = [];
  for (const asset of [...closure.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    const d = asset.definition;
    const root = `core/${d.kind}s/${d.id}`;
    const paths = ['definition.yaml', ...(d.kind === 'command' ? [] : [d.instructions, ...d.resources])];
    for (const relative of paths.sort()) {
      const file = `${root}/${relative}`;
      await assertNoSymlinks(inside(source, file));
      content.push([file, sha256(await readFile(inside(source, file)))]);
    }
  }
  const implementation: [string, string][] = [];
  for (const file of [...implementationFiles, `adapters/${harness}/index.ts`].sort()) {
    const absolute = inside(source, file);
    await assertNoSymlinks(absolute);
    implementation.push([file, sha256(await readFile(absolute))]);
  }
  return { core: sha256(JSON.stringify(content)), implementation: sha256(JSON.stringify(implementation)) };
}

export type Row = {
  asset: string; harness: AdapterId; compatibility: string; status: Status;
  stale: boolean; checkedAt: string | null; issues: string[]; recordPath: string | null;
};

export async function inspect(source: string, verificationRoot = path.join(source, 'docs/verification')): Promise<Row[]> {
  const catalog = await loadCatalog(path.join(source, 'core'));
  const records = new Map<string, { record: Record; relative: string }>();
  for (const kind of ['skill', 'agent', 'command']) {
    const directory = path.join(verificationRoot, kind);
    await assertNoSymlinks(directory);
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    for (const entry of entries) {
      if (!entry.isDirectory()) throw new Error(`Expected asset verification directory: ${entry.name}`);
      for (const file of await readdir(path.join(directory, entry.name))) {
        const relative = `${kind}/${entry.name}/${file}`;
        const absolute = inside(verificationRoot, relative);
        await assertNoSymlinks(absolute);
        if (!file.endsWith('.yaml')) throw new Error(`Unexpected verification file: ${relative}`);
        try {
          const record = recordSchema.parse(parse(await readFile(absolute, 'utf8')));
          if (record.asset !== `${kind}/${entry.name}` || file !== `${record.harness}.yaml`) {
            throw new Error('Record identity does not match path');
          }
          if (!catalog.has(record.asset)) throw new Error(`Unknown asset: ${record.asset}`);
          for (const c of record.cases) {
            for (const evidence of c.evidence) {
              if (!evidence.path.startsWith(`evidence/${kind}/${entry.name}/${record.harness}/`)) {
                throw new Error(`Evidence must belong to this asset/harness: ${evidence.path}`);
              }
              const artifact = inside(verificationRoot, evidence.path);
              await assertNoSymlinks(artifact);
              const bytes = await readFile(artifact);
              if (!bytes.length || sha256(bytes) !== evidence.sha256) throw new Error(`Evidence missing content or hash mismatch: ${evidence.path}`);
            }
          }
          if (statusOf(record) === 'passed') {
            if (!record.environment.harness_version || !record.environment.model) {
              throw new Error('Passed runtime verification requires harness version and model');
            }
          }
          records.set(`${record.asset}:${record.harness}`, { record, relative });
        } catch (error) { throw new Error(`${relative}: ${(error as Error).message}`); }
      }
    }
  }
  const rows: Row[] = [];
  for (const asset of catalog.values()) {
    for (const harness of adapterIds) {
      const adapter = getAdapter(harness);
      const compatibility = adapter.check(asset, catalog);
      const saved = records.get(`${asset.key}:${harness}`);
      const issues = compatibility.status === 'supported' ? [] : [compatibility.reason];
      let stale = false;
      if (saved) {
        const current = await fingerprint(source, catalog, asset.key, harness);
        stale = current.core !== saved.record.fingerprint.core || current.implementation !== saved.record.fingerprint.implementation ||
          saved.record.environment.adapter_revision !== adapter.version;
        if (!stale && statusOf(saved.record) === 'passed' && compatibility.status === 'unsupported') {
          throw new Error(`${saved.relative}: Cannot pass an unsupported mapping`);
        }
        if (stale) issues.push('Source/mapping changed since this record');
        for (const c of saved.record.cases.filter(c => c.outcome !== 'passed')) issues.push(`${c.id}: ${c.outcome} — ${c.observed}`);
        for (const s of stages) {
          if (!saved.record.cases.some(c => c.required && c.stage === s)) issues.push(`Missing required stage: ${s}`);
        }
        issues.push(...saved.record.limitations);
      } else issues.push('No per-asset runtime verification record');
      rows.push({ asset: asset.key, harness, compatibility: compatibility.status,
        status: saved ? statusOf(saved.record) : 'not-tested', stale,
        checkedAt: saved?.record.checked_at ?? null, issues, recordPath: saved?.relative ?? null });
    }
  }
  return rows;
}

const escape = (value: string): string => value.replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ');
export function report(rows: Row[]): string {
  const labels: { [S in Status]: string } = { 'not-tested': 'Not tested', passed: 'Passed', failed: 'Failed', blocked: 'Blocked', partial: 'Partial' };
  const counts = Object.entries(labels).map(([status, label]) => `${label}: ${rows.filter(r => r.status === status).length}`).join(' · ');
  return '# Kiểm chứng stuff\n\n' +
    'Generated by `npm run verification -- report`. Không sửa bảng bằng tay.\n\n' +
    'Hướng dẫn và format hồ sơ: [testing guide](../testing.md). Compatibility là khả năng adapter; kết quả là bằng chứng của từng stuff/harness.\n\n' +
    `${counts} · Stale: ${rows.filter(r => r.stale).length}\n\n` +
    '| Stuff | Harness | Mapping | Kết quả | Lượt test gần nhất | Vấn đề / giới hạn |\n|---|---|---|---|---|---|\n' +
    rows.map(r => `| ${r.recordPath ? `[${r.asset}](${r.recordPath})` : r.asset} | ${r.harness} | ${r.compatibility} | ${labels[r.status]}${r.stale ? ' (Stale)' : ''} | ${r.checkedAt ?? '—'} | ${escape(r.issues.join('; ') || '—')} |`).join('\n') + '\n';
}
