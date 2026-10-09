import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, unlink, open, realpath, link } from 'node:fs/promises';
import { hostname } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { adapterIds, type AdapterId, type OutputFile } from '../../../adapters/index.js';
import { getAdapter } from '../../../adapters/index.js';
import { relativePath, inside, assertNoSymlinks } from '../../../core/src/index.js';

export const hash = (content: Buffer | string): string => createHash('sha256').update(content).digest('hex');
const assetKey = z.string().regex(/^(skill|agent|command)\/[a-z0-9]+(-[a-z0-9]+)*$/);
const recordSchema = z.strictObject({ asset: assetKey, path: relativePath, hash: z.string().regex(/^[a-f0-9]{64}$/) });
const manifestSchema = z.strictObject({
  schema_version: z.literal(1), adapter: z.enum(adapterIds), adapter_version: z.number().int().positive(),
  source: z.string(), content_digest: z.string(), target: z.string(), files: z.array(recordSchema),
});
export type Manifest = z.infer<typeof manifestSchema>;
export type Context = { adapter: AdapterId; target: string; manifest: string };
export type Change = { asset: string; path: string; content: Buffer | null;
  action: 'create' | 'update' | 'unchanged' | 'remove' | 'conflict'; before: Buffer | null };
export type Plan = { context: Context; changes: Change[]; previousManifest: Buffer | null; nextManifest: Manifest };

export async function targetContext(scope: string, project: string, home: string, adapter: AdapterId = 'opencode'): Promise<Context> {
  if (scope !== 'global' && scope !== 'project') throw new Error('Scope must be global or project');
  const base = await realpath(scope === 'global' ? home : project);
  return { adapter, target: path.join(base, getAdapter(adapter).directories[scope]),
    // Scope is part of the state path, including when the project happens to be the home directory.
    manifest: path.join(base, `.agent-stuff/installations/${scope}/${adapter}.json`) };
}
export async function readOptional(file: string): Promise<Buffer | null> {
  await assertNoSymlinks(file);
  try {
    if (!(await lstat(file)).isFile()) throw new Error(`Expected regular file: ${file}`);
    return await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
function ownedPath(asset: string, file: string): void {
  assetKey.parse(asset); relativePath.parse(file);
  const [kind, id] = asset.split('/');
  const valid = kind === 'skill' ? file.startsWith(`skills/${id}/`)
    : file === `${kind}s/${id}.md`;
  if (!valid) throw new Error(`Path does not belong to ${asset}: ${file}`);
}
export function validateOutputs(files: OutputFile[]): void {
  const seen = new Set<string>();
  for (const file of files) {
    ownedPath(file.asset, file.path);
    const normalized = file.path.toLowerCase();
    if (seen.has(normalized)) throw new Error(`Output collision: ${file.path}`);
    for (const previous of seen) {
      if (previous.startsWith(`${normalized}/`) || normalized.startsWith(`${previous}/`)) throw new Error(`Output path conflict: ${file.path}`);
    }
    seen.add(normalized);
  }
}
function parseManifest(bytes: Buffer, context: Context): Manifest {
  const manifest = manifestSchema.parse(JSON.parse(bytes.toString()));
  if (manifest.target !== context.target || manifest.adapter !== context.adapter) throw new Error('Manifest target or adapter mismatch');
  for (const file of manifest.files) ownedPath(file.asset, file.path);
  validateOutputs(manifest.files.map(f => ({ ...f, content: Buffer.alloc(0) })));
  return manifest;
}
export async function readManifest(context: Context): Promise<Manifest | null> {
  const bytes = await readOptional(context.manifest);
  return bytes ? parseManifest(bytes, context) : null;
}
const journalPath = (context: Context): string => `${context.manifest}.journal`;
const same = (a: Buffer | null, b: Buffer | null): boolean => a === null ? b === null : b !== null && a.equals(b);
const encodedManifest = (manifest: Manifest): Buffer => Buffer.from(JSON.stringify(manifest, null, 2) + '\n');

export async function planInstall(context: Context, files: OutputFile[], source: string, removeAssets: string[] = []): Promise<Plan> {
  validateOutputs(files);
  await assertNoSymlinks(context.target);
  if (await readOptional(journalPath(context))) throw new Error('Interrupted transaction found; run recover first');
  const previousManifest = await readOptional(context.manifest);
  const previous = previousManifest ? parseManifest(previousManifest, context) : null;
  const old = new Map(previous?.files.map(f => [f.path, f]));
  const selected = new Set([...files.map(f => f.asset), ...removeAssets]);
  const wanted = new Set(files.map(f => f.path));
  const changes: Change[] = [];
  for (const file of files) {
    const before = await readOptional(inside(context.target, file.path));
    const tracked = old.get(file.path);
    const action = tracked && tracked.asset !== file.asset ? 'conflict'
      : before === null ? 'create'
      : !tracked || hash(before) !== tracked.hash ? 'conflict'
      : hash(before) === hash(file.content) ? 'unchanged' : 'update';
    changes.push({ ...file, before, action });
  }
  const records = new Map(old);
  for (const file of old.values()) {
    if (!selected.has(file.asset) || wanted.has(file.path)) continue;
    const before = await readOptional(inside(context.target, file.path));
    changes.push({ ...file, before, content: null,
      action: before !== null && hash(before) !== file.hash ? 'conflict' : 'remove' });
    records.delete(file.path);
  }
  for (const file of files) records.set(file.path, { asset: file.asset, path: file.path, hash: hash(file.content) });
  const all = [...records.values()].sort((a, b) => a.path.localeCompare(b.path));
  const nextManifest: Manifest = { schema_version: 1, adapter: context.adapter, adapter_version: getAdapter(context.adapter).version,
    source: path.resolve(source), content_digest: hash(JSON.stringify(all)), target: context.target, files: all };
  // Validate collisions against assets outside this selection as well.
  parseManifest(encodedManifest(nextManifest), context);
  return { context, changes, previousManifest, nextManifest };
}
export async function planUninstall(context: Context, only?: string[]): Promise<Plan> {
  const previous = await readManifest(context);
  if (!previous) throw new Error('No managed installation found');
  const installed = new Set(previous.files.map(f => f.asset));
  for (const key of only ?? []) if (!installed.has(key)) throw new Error(`Asset is not installed: ${key}`);
  return planInstall(context, [], previous.source, only ?? [...installed]);
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}
async function atomicWrite(file: string, content: Buffer): Promise<void> {
  await assertNoSymlinks(file);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
    await rename(temporary, file);
    await syncDirectory(path.dirname(file));
  } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
async function removeFile(file: string): Promise<void> {
  await assertNoSymlinks(file);
  await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await syncDirectory(path.dirname(file));
}
const lockSchema = z.strictObject({ pid: z.number().int().positive(), host: z.string(), token: z.string() });
async function acquireLock(file: string): Promise<() => Promise<void>> {
  await assertNoSymlinks(file);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  const owner = Buffer.from(JSON.stringify({ pid: process.pid, host: hostname(), token: randomUUID() }));
  try {
    await atomicWrite(temporary, owner);
    // The complete owner file becomes visible atomically, with exclusive creation.
    await link(temporary, file);
    await syncDirectory(path.dirname(file));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`Installation locked: ${file}. If interrupted, run recover.`);
    throw error;
  } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  return async () => {
    if (!same(await readOptional(file), owner)) throw new Error(`Lock ownership changed: ${file}`);
    await removeFile(file);
  };
}
async function clearDeadLock(file: string): Promise<void> {
  const bytes = await readOptional(file);
  if (!bytes) return;
  const owner = lockSchema.parse(JSON.parse(bytes.toString()));
  if (owner.host !== hostname()) throw new Error('Lock belongs to another host; refusing automatic recovery');
  try { process.kill(owner.pid, 0); throw new Error(`Installation process ${owner.pid} is still running`); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  if (!same(await readOptional(file), bytes)) throw new Error('Lock changed during recovery');
  await removeFile(file);
}
const journalSchema = z.strictObject({
  version: z.literal(1), target: z.string(), adapter: z.enum(adapterIds),
  previous: z.string().nullable(), next: z.string(),
  changes: z.array(z.strictObject({ asset: assetKey, path: relativePath, before: z.string().nullable(), after: z.string().nullable() })),
});
type Journal = z.infer<typeof journalSchema>;
const decode = (s: string | null): Buffer | null => s === null ? null : Buffer.from(s, 'base64');
function parseJournal(bytes: Buffer, context: Context): Journal {
  const journal = journalSchema.parse(JSON.parse(bytes.toString()));
  if (journal.target !== context.target || journal.adapter !== context.adapter) throw new Error('Journal target or adapter mismatch');
  const previous = journal.previous ? parseManifest(decode(journal.previous)!, context) : null;
  const next = parseManifest(decode(journal.next)!, context);
  const beforeFiles = new Map(previous?.files.map(f => [f.path, f]));
  const afterFiles = new Map(next.files.map(f => [f.path, f]));
  const seen = new Set<string>();
  for (const change of journal.changes) {
    ownedPath(change.asset, change.path);
    if (seen.has(change.path)) throw new Error('Duplicate journal path');
    seen.add(change.path);
    for (const [state, records] of [[change.before, beforeFiles], [change.after, afterFiles]] as const) {
      const record = records.get(change.path);
      if (state !== null && (!record || record.asset !== change.asset || record.hash !== hash(decode(state)!))) {
        throw new Error(`Journal content does not match manifest: ${change.path}`);
      }
    }
  }
  return journal;
}
async function rollback(context: Context, journal: Journal): Promise<void> {
  // Preflight all paths before restoring anything. External edits are never overwritten.
  for (const change of journal.changes) {
    const current = await readOptional(inside(context.target, change.path));
    if (!same(current, decode(change.before)) && !same(current, decode(change.after))) {
      throw new Error(`Recovery conflict: ${change.path}; journal retained for inspection`);
    }
  }
  for (const change of [...journal.changes].reverse()) {
    const destination = inside(context.target, change.path);
    const current = await readOptional(destination);
    if (same(current, decode(change.before))) continue;
    if (!same(current, decode(change.after))) throw new Error(`Recovery conflict: ${change.path}`);
    if (change.before === null) await removeFile(destination);
    else await atomicWrite(destination, decode(change.before)!);
  }
}
export async function applyInstall(plan: Plan, onProgress?: (completed: number) => void | Promise<void>): Promise<void> {
  if (plan.changes.some(c => c.action === 'conflict')) throw new Error('Installation has conflicts. No files changed.');
  const { context } = plan;
  // A separate gate prevents recovery and normal installation from racing over stale locks.
  const releaseGate = await acquireLock(`${context.manifest}.gate`);
  let release: (() => Promise<void>) | undefined;
  try {
    release = await acquireLock(`${context.manifest}.lock`);
    if (await readOptional(journalPath(context))) throw new Error('Interrupted transaction found; run recover first');
    if (!same(await readOptional(context.manifest), plan.previousManifest)) throw new Error('Manifest changed since preview; run again');
    for (const change of plan.changes) {
      if (!same(await readOptional(inside(context.target, change.path)), change.before)) throw new Error(`File changed since preview: ${change.path}`);
    }
    if (plan.changes.every(c => c.action === 'unchanged')) return;
    const journal: Journal = { version: 1, target: context.target, adapter: context.adapter,
      previous: plan.previousManifest?.toString('base64') ?? null, next: encodedManifest(plan.nextManifest).toString('base64'),
      changes: plan.changes.filter(c => c.action !== 'unchanged').map(c => ({ asset: c.asset, path: c.path,
        before: c.before?.toString('base64') ?? null, after: c.content?.toString('base64') ?? null })) };
    await atomicWrite(journalPath(context), Buffer.from(JSON.stringify(journal)));
    let committed = false;
    try {
      let completed = 0;
      for (const change of journal.changes) {
        const destination = inside(context.target, change.path);
        if (!same(await readOptional(destination), decode(change.before))) throw new Error(`File changed during install: ${change.path}`);
        if (change.after === null) { if (change.before !== null) await removeFile(destination); }
        else await atomicWrite(destination, decode(change.after)!);
        await onProgress?.(++completed);
      }
      await atomicWrite(context.manifest, encodedManifest(plan.nextManifest));
      committed = true;
      await removeFile(journalPath(context));
    } catch (error) {
      // If rename committed the manifest but a later sync failed, recovery finalizes it.
      if (!committed && !same(await readOptional(context.manifest), encodedManifest(plan.nextManifest))) {
        try { await rollback(context, journal); await removeFile(journalPath(context)); }
        catch (recoveryError) { throw new AggregateError([error, recoveryError], 'Installation failed; journal retained. Run recover.'); }
      }
      throw error;
    }
  } finally { try { await release?.(); } finally { await releaseGate(); } }
}
export async function recoverInstall(context: Context): Promise<string> {
  // A dead gate is removed only by explicit recovery. Live owners are never displaced.
  await clearDeadLock(`${context.manifest}.gate`);
  const releaseGate = await acquireLock(`${context.manifest}.gate`);
  let release: (() => Promise<void>) | undefined;
  try {
    await clearDeadLock(`${context.manifest}.lock`);
    release = await acquireLock(`${context.manifest}.lock`);
    const bytes = await readOptional(journalPath(context));
    if (!bytes) return 'No interrupted transaction; stale locks cleared';
    const journal = parseJournal(bytes, context);
    const currentManifest = await readOptional(context.manifest);
    if (same(currentManifest, decode(journal.next))) {
      await removeFile(journalPath(context));
      return 'Committed transaction finalized';
    }
    if (!same(currentManifest, decode(journal.previous))) throw new Error('Manifest changed outside transaction; journal retained');
    await rollback(context, journal);
    await removeFile(journalPath(context));
    return 'Interrupted transaction rolled back';
  } finally { try { await release?.(); } finally { await releaseGate(); } }
}
