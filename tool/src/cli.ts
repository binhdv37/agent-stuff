#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { homedir } from 'node:os';
import { mkdir, writeFile, lstat } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadCatalog, selectAssets, inside, assertNoSymlinks } from '../../core/src/index.js';
import { adapters, getAdapter, type Compatibility } from '../../adapters/index.js';
import { applyInstall, planInstall, planUninstall, readManifest, recoverInstall, targetContext, validateOutputs, type Plan } from './installation/index.js';

function printCompatibility(result: Compatibility): void {
  console.log(`${result.status}: ${result.asset}${result.issues.length ? '' : `: ${result.reason}`}`);
  for (const issue of result.issues) {
    console.log(`  ${issue.field} [${issue.status}]: ${issue.reason}`);
    console.log(`    Effect: ${issue.effect}`);
  }
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    source: { type: 'string' }, agent: { type: 'string' }, scope: { type: 'string' },
    project: { type: 'string' }, only: { type: 'string', multiple: true }, out: { type: 'string' },
    'dry-run': { type: 'boolean' }, 'accept-limitations': { type: 'boolean' },
    'compatible-only': { type: 'boolean' }, yes: { type: 'boolean' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('Usage: npm run cli -- <list|validate|build|install|update|uninstall|recover> [options]\n' +
      '  --source <checkout> --agent opencode|codex|claude-code\n' +
      '  --scope project|global --project <existing directory>\n' +
      '  --only skill/id (repeatable) --compatible-only --out <new build directory>\n' +
      '  --dry-run --accept-limitations --yes\n' +
      'Without flags, install prompts for harness, scope, assets and confirmation.');
    return;
  }
  const command = positionals[0] ?? 'install';
  if (positionals.length > 1 || !['list', 'validate', 'build', 'install', 'update', 'uninstall', 'recover'].includes(command)) throw new Error('Unknown command; use --help');
  const interactive = process.stdin.isTTY && !values.yes;
  const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : undefined;
  const ask = async (question: string): Promise<string> => {
    if (!rl) throw new Error(`Missing options for non-interactive execution: ${question}`);
    return (await rl.question(question)).trim();
  };
  try {
    if (['list', 'validate'].includes(command)) {
      const catalog = await loadCatalog(path.join(path.resolve(values.source ?? fileURLToPath(new URL('../../../', import.meta.url))), 'core'));
      if (command === 'validate') console.log(`Validated ${catalog.size} assets`);
      else for (const a of catalog.values()) console.log(`${a.key}\t${a.definition.description}`);
      return;
    }
    const agent = values.agent ?? await ask(`Harness (${adapters.map(a => a.id).join(', ')}): `);
    const adapter = getAdapter(agent);
    const scope = command === 'build' ? undefined : values.scope ?? await ask('Scope (project/global): ');
    const project = values.project ?? (scope === 'project' && interactive ? (await ask(`Project directory [${process.cwd()}]: `) || process.cwd()) : process.cwd());
    if (scope === 'project' && !values.project && !interactive) throw new Error('Project install requires --project <existing directory>');
    const context = scope ? await targetContext(scope, project, homedir(), adapter.id) : undefined;
    if (command === 'recover') {
      if (values['dry-run']) throw new Error('Recover does not support --dry-run; inspect the journal before applying');
      if (!values.yes && (await ask('Recover the interrupted installation? [y/N]: ')).toLowerCase() !== 'y') return;
      console.log(await recoverInstall(context!)); return;
    }
    let plan: Plan;
    let limited = false;
    if (command === 'uninstall') {
      plan = await planUninstall(context!, values.only);
    } else {
      const installed = command === 'update' ? await readManifest(context!) : null;
      if (command === 'update' && !installed) throw new Error('No managed installation found');
      const source = path.resolve(values.source ?? installed?.source ?? fileURLToPath(new URL('../../../', import.meta.url)));
      const catalog = await loadCatalog(path.join(source, 'core'));
      let keys = values.only;
      if (installed) {
        const installedKeys = [...new Set(installed.files.map(f => f.asset))];
        if (keys?.some(k => !installedKeys.includes(k))) throw new Error('Update --only must refer to installed assets');
        keys ??= installedKeys;
      }
      const removed = installed ? (keys ?? []).filter(k => !catalog.has(k)) : [];
      const presentKeys = keys?.filter(k => catalog.has(k) || !installed);
      let selected = presentKeys?.length === 0 ? [] : selectAssets(catalog, presentKeys);
      if (interactive && command === 'install' && !keys) {
        const compatible = selected.filter(a => adapter.check(a, catalog).status !== 'unsupported');
        for (const a of selected) {
          const c = adapter.check(a, catalog);
          printCompatibility(c);
        }
        const answer = await ask('Assets (comma-separated kind/id; Enter selects all compatible assets): ');
        selected = answer ? selectAssets(catalog, answer.split(',').map(s => s.trim())) : compatible;
      }
      const compatibility = selected.map(a => adapter.check(a, catalog));
      for (const c of compatibility) printCompatibility(c);
      if (values['compatible-only']) {
        if (command === 'update') throw new Error('Update cannot skip incompatible installed assets; select them explicitly');
        selected = selected.filter(a => adapter.check(a, catalog).status !== 'unsupported');
      } else if (compatibility.some(c => c.status === 'unsupported')) {
        throw new Error('Selection contains unsupported assets; use --only or --compatible-only');
      }
      limited = selected.some(a => adapter.check(a, catalog).status === 'limited');
      const files = selected.flatMap(a => adapter.render(a, catalog));
      if (!files.length && !removed.length) throw new Error('No compatible assets selected');
      validateOutputs(files);
      if (command === 'build') {
        if (!values.out) throw new Error('Build requires --out <new directory>');
        if (values['dry-run']) { for (const file of files) console.log(`render ${file.path}`); return; }
        const out = path.resolve(values.out);
        await assertNoSymlinks(out);
        try { await lstat(out); throw new Error('Build output already exists; choose a new directory'); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        for (const file of files) {
          const destination = inside(out, file.path);
          await mkdir(path.dirname(destination), { recursive: true });
          await writeFile(destination, file.content, { flag: 'wx' });
        }
        console.log(`Built ${files.length} files in ${out}`); return;
      }
      plan = await planInstall(context!, files, source, removed);
    }
    for (const change of plan.changes) console.log(`${change.action} ${inside(plan.context.target, change.path)}`);
    if (plan.changes.some(c => c.action === 'conflict')) throw new Error('Conflicts found; no files changed');
    if (values['dry-run']) return;
    if (limited && !values['accept-limitations']) {
      if (!interactive || (await ask('Accept the compatibility limitations shown above? [y/N]: ')).toLowerCase() !== 'y') {
        throw new Error('Use --accept-limitations after reviewing compatibility');
      }
    }
    if (!values.yes && (await ask('Apply these changes? [y/N]: ')).toLowerCase() !== 'y') return;
    await applyInstall(plan);
    console.log(`${command} complete`);
  } finally { rl?.close(); }
}
main().catch(error => { console.error((error as Error).message); process.exitCode = 1; });
