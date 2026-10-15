#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { homedir } from 'node:os';
import { mkdir, writeFile, lstat, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadCatalog, selectAssets, inside, assertNoSymlinks } from '../../core/src/index.js';
import { getAdapter, adapterIds } from '../../adapters/index.js';
import { applyInstall, planInstall, planUninstall, readManifest, inspectInstallation, recoverInstall, targetContext, validateOutputs, type Plan } from './installation/index.js';
import { Cancelled, InteractiveFlow, catalogItems, formatList, formatStatus, formatCompatibility, formatPreview } from './prompts.js';
import { resolveSource } from './source.js';

const commands = ['list', 'status', 'install', 'update', 'uninstall', 'recover', 'validate', 'build'];
const usage = (command: string): string => `Usage: agent-stuff ${command} [options]`;
const options: Record<string, string> = {
  source: '<checkout>  Read core content from this checkout/package (default: source accompanying CLI)',
  agent: 'opencode|codex|claude-code  Choose an AI tool',
  scope: 'project|global  Choose installation scope',
  project: '<directory>  Choose an existing project directory',
  only: '<kind/id>  Select an item; repeat for multiple items',
  out: '<new directory>  Write rendered files to a new directory',
  'dry-run': 'Preview without applying changes',
  'accept-limitations': 'Explicitly accept reported compatibility limitations',
  'compatible-only': 'Explicitly skip unsupported items',
  yes: 'Apply without prompts; does not accept limitations or bypass conflicts',
  verbose: 'Show individual files and full compatibility details',
  json: 'Write complete, untruncated JSON to stdout',
  help: 'Show help for this command',
};
const targetOptions = ['agent', 'scope', 'project'];
const applyOptions = ['only', 'dry-run', 'yes', 'verbose'];
const commandHelp: Record<string, { description: string; flags: string[]; example: string; note?: string }> = {
  list: { description: 'List available skills, commands, and agents.', flags: ['source', 'agent', 'json'],
    example: 'list --agent claude-code', note: 'Without --agent, show the whole catalog. With --agent, mark compatibility without hiding items.' },
  status: { description: 'Inspect managed installations without changing files or installation state.',
    flags: [...targetOptions, 'verbose', 'json'], example: 'status --scope project --project /path/to/project',
    note: 'Defaults: all AI tools, both scopes, current directory for project scope. Reports tracked files only; no source checkout is required.' },
  install: { description: 'Install selected items after reviewing compatibility and file changes.',
    flags: ['source', ...targetOptions, ...applyOptions, 'compatible-only', 'accept-limitations'],
    example: 'install --agent codex --scope project --project /path/to/project --only skill/bdv-api-handoff --dry-run',
    note: 'Without flags, prompts guide installation. Without a terminal, supply --agent, --scope, --project for project scope, and --yes unless previewing.' },
  update: { description: 'Update managed items using their recorded source and selection by default.',
    flags: ['source', ...targetOptions, ...applyOptions, 'accept-limitations'],
    example: 'update --agent codex --scope global --dry-run', note: 'Update uses the recorded local directory or the invoked package version. --source explicitly switches to a local directory; --only defaults to all installed items.' },
  uninstall: { description: 'Remove managed files, preserving modified and unrelated files.',
    flags: [...targetOptions, ...applyOptions], example: 'uninstall --agent codex --scope global --only skill/bdv-api-handoff --dry-run' },
  recover: { description: 'Recover an interrupted installation from its journal.',
    flags: [...targetOptions, 'yes'], example: 'recover --agent codex --scope global',
    note: 'Recovery applies changes and has no dry-run mode.' },
  validate: { description: 'Validate the portable source catalog.', flags: ['source'], example: 'validate --source .' },
  build: { description: 'Render compatible items into a new output directory without installing.',
    flags: ['source', 'agent', 'only', 'compatible-only', 'out', 'dry-run', 'verbose'],
    example: 'build --agent codex --compatible-only --out /path/to/new-preview', note: '--agent and --out are required.' },
};

function help(command?: string): string {
  if (!command) return [
    'Usage: agent-stuff [command] [options]', '', 'End-user commands:',
    ...commands.slice(0, 6).map(name => `  ${name.padEnd(12)} ${commandHelp[name]!.description}`),
    '', 'Contributor commands:',
    ...commands.slice(6).map(name => `  ${name.padEnd(12)} ${commandHelp[name]!.description}`),
    '', 'Run with npx agent-stuff@latest, or bash install.sh from a checkout.',
    'With no command, the CLI defaults to install. Run agent-stuff <command> --help for flags and defaults.',
    '--verbose: show individual files and full compatibility details on install/update/uninstall; all tracked files on status.',
    '', 'Examples:', '  agent-stuff list --agent claude-code', '  agent-stuff status', '  agent-stuff install',
  ].join('\n');
  const entry = commandHelp[command]!;
  return [usage(command), '', entry.description, '', 'Options:',
    ...[...entry.flags, 'help'].map(flag => `  --${flag} ${command === 'status' && flag === 'verbose' ? 'Show every tracked file, including unchanged files' : options[flag]}`),
    ...(entry.note ? ['', entry.note] : []), '', 'Example:', `  agent-stuff ${entry.example}`,
  ].join('\n');
}

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) {
      next.push(Math.min(next[j]! + 1, row[j + 1]! + 1, row[j]! + (a[i] === b[j] ? 0 : 1)));
    }
    row = next;
  }
  return row[b.length]!;
}

function suggestion(value: string, choices: string[]): string {
  const exact = choices.filter(key => key.split('/').at(-1) === value);
  const prefixes = choices.filter(key => key.startsWith(value));
  const ranked = choices.map(key => ({ key, score: distance(value, value.includes('/') ? key : key.split('/').at(-1)!) }))
    .sort((a, b) => a.score - b.score);
  const matches = exact.length ? exact : ranked[0] && ranked[0].score <= Math.min(3, Math.floor(value.length / 4))
    ? ranked.filter(item => item.score === ranked[0]!.score).map(item => item.key)
    : value.length >= 3 && prefixes.length === 1 ? prefixes : [];
  return matches.length ? ` Did you mean ${matches.join(' or ')}?` : '';
}

function checkSelection(keys: string[] | undefined, available: string[], action = 'Unknown item'): void {
  const unknown = keys?.filter(key => !available.includes(key));
  if (unknown?.length) throw new Error(unknown.map(key => `${action} in --only: "${key}".${suggestion(key, available)}`).join('\n') +
    '\nRun `agent-stuff list` to see available items; pass a full key with --only.');
}

async function checkProject(project: string): Promise<void> {
  let info;
  try { info = await stat(project); }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      throw new Error(`Project directory not found: ${project}\nPass an existing directory with --project.`);
    }
    if (code === 'EACCES' || code === 'EPERM') {
      throw new Error(`Cannot access --project directory: ${project}\nCheck directory permissions or pass an accessible directory with --project.`);
    }
    throw error;
  }
  if (!info.isDirectory()) throw new Error(`--project is not a directory: ${project}\nPass an existing directory with --project.`);
}

async function main(): Promise<void> {
  const parse = () => parseArgs({ allowPositionals: true, options: {
    source: { type: 'string' }, agent: { type: 'string' }, scope: { type: 'string' },
    project: { type: 'string' }, only: { type: 'string', multiple: true }, out: { type: 'string' },
    'dry-run': { type: 'boolean' }, 'accept-limitations': { type: 'boolean' },
    'compatible-only': { type: 'boolean' }, yes: { type: 'boolean' }, help: { type: 'boolean' },
    verbose: { type: 'boolean' }, json: { type: 'boolean' },
  } });
  let args: ReturnType<typeof parse>;
  try { args = parse(); }
  catch (error) {
    const e = error as NodeJS.ErrnoException;
    if (!e.code?.startsWith('ERR_PARSE_ARGS_')) throw error;
    const command = commands.includes(process.argv[2] ?? '') ? process.argv[2]! : 'install';
    const option = e.message.match(/'(--?[^'\s]+)/)?.[1];
    const switches = ['--dry-run', '--accept-limitations', '--compatible-only', '--yes', '--help', '--verbose', '--json'];
    const message = e.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION'
      ? `Unknown option "${option}". Remove it or use a supported flag.`
      : switches.includes(option ?? '') ? `${option} does not take a value.\nPass ${option} without an argument or =value.`
        : `Missing or invalid value for ${option ?? 'an option'}.\nPass ${option ?? 'the option'} <value>; use ${option}=<value> if the value starts with a dash.`;
    throw new Error(`${message}\n${usage(command)}\nRun \`agent-stuff ${command} --help\` for options.`);
  }
  const { values, positionals } = args;
  const command = positionals[0] ?? 'install';
  if (!commands.includes(command)) throw new Error(`Unknown command "${command}".\nChoose ${commands.join(', ')}; run \`agent-stuff --help\` for options.`);
  if (positionals.length > 1) throw new Error(`Unexpected argument "${positionals[1]}" for ${command}.\n${usage(command)}\nRemove extra arguments; select items with --only <kind/id>.`);
  if (values.help) { console.log(help(positionals[0])); return; }
  if (values.json && !['list', 'status'].includes(command)) throw new Error(`--json is only supported by list and status.\nRun \`agent-stuff ${command} --help\` for options.`);
  if (['list', 'status'].includes(command)) {
    const unsupported = Object.keys(values).filter(flag => !commandHelp[command]!.flags.includes(flag));
    if (unsupported.length) throw new Error(`Unsupported options for ${command}: ${unsupported.map(flag => `--${flag}`).join(', ')}.\nRun \`agent-stuff ${command} --help\` for options.`);
  }
  const interactive = process.stdin.isTTY && !values.yes;
  const flow = interactive ? new InteractiveFlow() : undefined;
  const missing = (...flags: string[]): never => { throw new Error(`Missing required options for ${command}: ${flags.join(', ')}.\nPass ${flags.join(' and ')}; run \`agent-stuff ${command} --help\` for values.`); };
  try {
    if (values.agent && !adapterIds.includes(values.agent as typeof adapterIds[number])) {
      throw new Error(`Unknown --agent value "${values.agent}".${suggestion(values.agent, [...adapterIds])}\nUse --agent ${adapterIds.join('|')}.`);
    }
    if (command !== 'build' && values.scope && !['project', 'global'].includes(values.scope)) {
      throw new Error(`Invalid --scope value "${values.scope}".\nUse --scope project or --scope global.`);
    }
    if (['list', 'validate'].includes(command)) {
      const catalog = await loadCatalog(path.join(path.resolve(values.source ?? fileURLToPath(new URL('../../../', import.meta.url))), 'core'));
      if (command === 'validate') console.log(`Validated ${catalog.size} assets`);
      else {
        const items = catalogItems(catalog, values.agent ? getAdapter(values.agent) : undefined);
        console.log(values.json ? JSON.stringify({ schema_version: 1, agent: values.agent ?? null, items }, null, 2)
          : formatList(items, process.stdout.columns ?? 100));
      }
      return;
    }
    if (command === 'status') {
      const project = values.project ?? process.cwd();
      const scopes = values.scope ? [values.scope] : ['project', 'global'];
      if (scopes.includes('project')) await checkProject(project);
      const installations = [];
      for (const scope of scopes) {
        for (const id of values.agent ? [values.agent] : adapterIds) {
          const context = await targetContext(scope, project, homedir(), getAdapter(id).id);
          installations.push({ scope, ...await inspectInstallation(context) });
        }
      }
      console.log(values.json ? JSON.stringify({ schema_version: 1, installations }, null, 2)
        : formatStatus(installations, values.verbose));
      if (installations.some(installation => installation.error || installation.files.some(file => file.error))) process.exitCode = 1;
      return;
    }
    if (!flow) {
      const required = [!values.agent && '--agent', command !== 'build' && !values.scope && '--scope',
        command !== 'build' && values.scope === 'project' && !values.project && '--project',
        command === 'build' && !values.out && '--out',
        command !== 'build' && !values['dry-run'] && !values.yes && '--yes'].filter((flag): flag is string => Boolean(flag));
      if (required.length) missing(...required);
    }
    flow?.start(command);
    const agent = values.agent ?? (flow ? await flow.harness() : missing('--agent'));
    const adapter = getAdapter(agent);
    const scope = command === 'build' ? undefined : values.scope ?? (flow ? await flow.scope() : missing('--scope'));
    const defaultSource = path.resolve(values.source ?? fileURLToPath(new URL('../../../', import.meta.url)));
    const project = values.project ?? (scope === 'project' && flow ? await flow.project(defaultSource) : process.cwd());
    if (scope === 'project') await checkProject(project);
    const context = scope ? await targetContext(scope, project, homedir(), adapter.id) : undefined;
    if (command === 'recover') {
      if (values['dry-run']) throw new Error('Recover does not support --dry-run; inspect the journal before applying');
      if (!values.yes) { if (flow) await flow.confirm('Recover the interrupted installation?', false); else missing('--yes'); }
      console.log(await recoverInstall(context!)); return;
    }
    let plan: Plan;
    let limited = false;
    let selectedKeys: string[] = [];
    if (command === 'uninstall') {
      if (values.only) {
        const installed = await readManifest(context!);
        checkSelection(values.only, [...new Set(installed?.files.map(f => f.asset) ?? [])], 'Item is not installed');
      }
      plan = await planUninstall(context!, values.only);
    } else {
      const installed = command === 'update' ? await readManifest(context!) : null;
      if (command === 'update' && !installed) throw new Error(`No managed installation found for --agent ${agent} --scope ${scope}.\nRun \`agent-stuff install\` with the same target options first.`);
      const { root: sourceRoot, source } = await resolveSource(fileURLToPath(new URL('../../../', import.meta.url)), values.source, installed?.source);
      const catalog = await loadCatalog(path.join(sourceRoot, 'core'));
      let keys = values.only;
      if (installed) {
        const installedKeys = [...new Set(installed.files.map(f => f.asset))];
        checkSelection(keys, installedKeys, 'Item is not installed');
        keys ??= installedKeys;
      } else checkSelection(keys, [...catalog.keys()]);
      const removed = installed ? (keys ?? []).filter(k => !catalog.has(k)) : [];
      const presentKeys = keys?.filter(k => catalog.has(k) || !installed);
      let selected = presentKeys?.length === 0 ? [] : selectAssets(catalog, presentKeys);
      if (interactive && command === 'install' && !keys) {
        keys = await flow!.assets(catalog, adapter);
        selected = selectAssets(catalog, keys);
      }
      const compatibility = selected.map(a => adapter.check(a, catalog));
      if (flow) flow.compatibility(compatibility, values.verbose);
      else console.log(`Compatibility\n${formatCompatibility(compatibility, process.stdout.columns ?? 100, values.verbose)}`);
      if (values['compatible-only']) {
        if (command === 'update') throw new Error('Update does not support --compatible-only.\nRemove --compatible-only; use --only <installed-key> to explicitly select installed items.');
        selected = selected.filter(a => adapter.check(a, catalog).status !== 'unsupported');
      } else if (compatibility.some(c => c.status === 'unsupported')) {
        const unsupported = compatibility.filter(c => c.status === 'unsupported').map(c => c.asset);
        throw new Error(`Selection contains unsupported assets for --agent ${agent}: ${unsupported.join(', ')}.\n` +
          (command === 'update' ? 'Use --only to explicitly select supported installed items.'
            : values.only ? 'Remove the unsupported --only entries, or add --compatible-only to explicitly skip unsupported items.'
              : 'Use --only <supported-key> or --compatible-only to explicitly skip unsupported items.'));
      }
      limited = selected.some(a => adapter.check(a, catalog).status === 'limited');
      selectedKeys = (keys ?? selected.map(a => a.key)).filter(key => selected.some(a => a.key === key));
      const files = selected.flatMap(a => adapter.render(a, catalog));
      if (!files.length && !removed.length) throw new Error(`No compatible assets selected for --agent ${agent}.\nRun \`agent-stuff list\` and choose supported items with --only, or choose another --agent.`);
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
    const hasConflicts = plan.changes.some(c => c.action === 'conflict');
    if (!hasConflicts && !flow && !values['dry-run'] && limited && !values['accept-limitations']) {
      throw new Error('Selected items have compatibility limitations. No files changed.\nReview the compatibility details above, then rerun with --accept-limitations; --yes alone does not accept limitations.');
    }
    if (flow) flow.preview(plan, command, values.verbose);
    else console.log(`Review changes\n${formatPreview(plan, command, values.verbose)}`);
    if (hasConflicts) throw new Error(`${command} blocked by conflicts. No files changed.`);
    if (values['dry-run']) { flow?.previewComplete(); return; }
    if (limited && !values['accept-limitations']) {
      await flow!.confirm('Accept the compatibility limitations shown above?');
    }
    if (!values.yes) { if (flow) await flow.confirm('Apply these changes?'); else missing('--yes'); }
    if (flow) {
      await flow.apply(command, plan, () => applyInstall(plan));
      flow.complete(command, plan, scope, project, selectedKeys);
    } else {
      await applyInstall(plan);
      console.log(`${command} complete`);
    }
  } catch (error) {
    if (error instanceof Cancelled) { flow?.cancel(); return; }
    throw error;
  }
}
main().catch(error => { console.error((error as Error).message); process.exitCode = 1; });
