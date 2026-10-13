import * as prompts from '@clack/prompts';
import { realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { Asset } from '../../core/src/index.js';
import { adapters, type Adapter, type Compatibility } from '../../adapters/index.js';
import type { Plan } from './installation/index.js';

export class Cancelled extends Error {}

export const harnessNames: Record<string, string> = {
  opencode: 'OpenCode', codex: 'Codex', 'claude-code': 'Claude Code',
};

function answer<T>(value: T | typeof prompts.CANCEL_SYMBOL): T {
  if (prompts.isCancel(value)) throw new Cancelled();
  return value as T;
}

export type ProgressBar = {
  start(message: string): void;
  update(fraction: number): void;
  stop(message: string): void;
  error(message: string): void;
};

// A left-to-right fill bar rendered directly so we control the color (clack's
// `progress` hardcodes magenta). Colors respect NO_COLOR and non-TTY output.
const colorEnabled = process.env.NO_COLOR === undefined && (process.stdout.isTTY ?? false);
const paint = (code: string) => (text: string) => (colorEnabled ? `\u001b[${code}m${text}\u001b[0m` : text);
const cyan = paint('96');
const dim = paint('2');
const gray = paint('90');
const green = paint('32');
const red = paint('31');

export function createBar(out: NodeJS.WriteStream = process.stdout): ProgressBar {
  let message = '';
  let active = false;
  const render = (fraction: number): string => {
    const columns = out.columns ?? 80;
    const barWidth = Math.max(8, Math.min(28, columns - 18));
    const filled = Math.round(fraction * barWidth);
    const pct = `${String(Math.round(fraction * 100)).padStart(3)}%`;
    const bar = cyan('█'.repeat(filled)) + dim('░'.repeat(barWidth - filled));
    let label = message;
    const used = 2 + barWidth + 1 + pct.length + 1 + label.length;
    if (used > columns - 1) {
      const room = columns - 1 - (2 + barWidth + 1 + pct.length + 1);
      label = room > 0 ? `${label.slice(0, Math.max(0, room - 1))}…` : '';
    }
    return `${gray('│')} ${bar} ${pct} ${label}`;
  };
  return {
    start(msg) { message = msg; active = true; out.write(render(0)); },
    update(fraction) { if (active) out.write(`\r\u001b[K${render(fraction)}`); },
    stop(msg) { if (active) out.write(`\r\u001b[K${green('✓')} ${msg}\n`); active = false; },
    error(msg) { if (active) out.write(`\r\u001b[K${red('✖')} ${msg}\n`); active = false; },
  };
}

export function projectPath(value: string): string {
  const trimmed = value.trim();
  return path.resolve(trimmed === '~' ? homedir() : trimmed.startsWith('~/') ? path.join(homedir(), trimmed.slice(2)) : trimmed);
}

export function validateProject(value: string | undefined): string | undefined {
  if (!value?.trim()) return 'Enter the path to an existing project directory.';
  try {
    if (!statSync(projectPath(value)).isDirectory()) return 'This path is a file. Choose a project directory.';
  } catch {
    return 'Cannot open this directory. Check the path and permissions, then try again.';
  }
}

export function assetOptions(catalog: Map<string, Asset>, adapter: Adapter): Record<string, prompts.Option<string>[]> {
  const groups: Record<string, prompts.Option<string>[]> = {};
  const labels = { skill: 'Skills · workflows', command: 'Commands · shortcuts', agent: 'Agents · roles' };
  for (const asset of catalog.values()) {
    const compatibility = adapter.check(asset, catalog);
    const description = asset.definition.short_description ?? asset.definition.description.split(/(?<=[.!?])\s/)[0]!;
    const summary = description.replace(/\s+/g, ' ').trim();
    const hint = compatibility.status === 'unsupported'
      ? `Not supported: ${compatibility.reason || compatibility.issues.map(i => i.effect).join(' ')}`
      : `${compatibility.status === 'limited' ? 'Limited · ' : ''}${summary.length > 100 ? `${summary.slice(0, 97)}…` : summary}`;
    (groups[labels[asset.definition.kind]] ??= []).push({
      value: asset.key, label: asset.definition.display_name ?? asset.definition.id,
      hint, disabled: compatibility.status === 'unsupported',
    });
  }
  return groups;
}

function wrap(value: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (let word of value.split(/\s+/)) {
    if (!word) continue;
    if (line && line.length + word.length + 1 > width) { lines.push(line); line = ''; }
    while (word.length > width) { lines.push(word.slice(0, width)); word = word.slice(width); }
    line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export function formatCompatibility(results: Compatibility[], width: number): string {
  if (!results.length) return 'No items to review.';
  width = Math.max(16, width);
  const notes = new Map<string, { id: number; text: string }>();
  const reference = (status: string, text: string): number => {
    const key = JSON.stringify([status, text]);
    if (!notes.has(key)) notes.set(key, { id: notes.size + 1, text: `${status}: ${text}` });
    return notes.get(key)!.id;
  };
  const statuses = { supported: 'Full', limited: 'Limited', unsupported: 'Not supported' };
  const rows = results.map(result => {
    const fields = new Map<number, Set<string>>();
    for (const issue of result.issues) {
      const id = reference(statuses[issue.status], issue.effect || issue.reason);
      if (!fields.has(id)) fields.set(id, new Set());
      fields.get(id)!.add(issue.field);
    }
    const details = [...fields].map(([id, names]) => `${[...names].join(', ')} [${id}]`).join('; ')
      || (result.status === 'supported' ? '—' : `See [${reference(statuses[result.status], result.reason)}]`);
    return [result.asset, statuses[result.status], details];
  });
  let lines: string[];
  if (width < 68) {
    lines = rows.flatMap(([asset, status, details]) => [
      ...wrap(asset!, width), ...wrap(`Support: ${status}`, width),
      ...(details === '—' ? [] : wrap(`Details: ${details}`, width)), '',
    ]);
  } else {
    const longest = Math.max(4, ...rows.map(row => row[0]!.length));
    const statusWidth = Math.max(7, ...rows.map(row => row[1]!.length));
    const itemWidth = Math.min(longest, Math.max(4, width - statusWidth - 6 - 12));
    const widths = [itemWidth, statusWidth, width - itemWidth - statusWidth - 6];
    const renderRow = (row: string[]): string[] => {
      const cells = row.map((cell, index) => wrap(cell, widths[index]!));
      return Array.from({ length: Math.max(...cells.map(cell => cell.length)) }, (_, index) =>
        cells.map((cell, column) => (cell[index] ?? '').padEnd(widths[column]!)).join(' | ').trimEnd());
    };
    lines = [
      ...renderRow(['Item', 'Support', 'Details']), widths.map(w => '-'.repeat(w)).join('-+-'),
      ...rows.flatMap(renderRow),
    ];
  }
  if (notes.size) {
    lines.push('', 'Notes');
    for (const { id, text } of notes.values()) {
      const prefix = `[${id}] `;
      lines.push(...wrap(text, width - prefix.length).map((line, index) => `${index ? ' '.repeat(prefix.length) : prefix}${line}`));
    }
  }
  return lines.join('\n').trimEnd();
}

export function completionSummary(command: string, plan: Plan): string {
  const titles: Record<string, string> = { install: 'Installation', update: 'Update', uninstall: 'Uninstall' };
  const kinds = ['skill', 'command', 'agent'];
  const assets = new Set(plan.changes.map(change => change.asset));
  const items = kinds.flatMap(kind => {
    const count = [...assets].filter(key => key.startsWith(`${kind}/`)).length;
    return count ? [`${count} ${kind}${count === 1 ? '' : 's'}`] : [];
  });
  const actions = { create: 'created', update: 'updated', remove: 'removed', unchanged: 'unchanged' } as const;
  const files = Object.entries(actions).flatMap(([action, label]) => {
    const count = plan.changes.filter(change => change.action === action).length;
    return count ? [`${count} file${count === 1 ? '' : 's'} ${label}`] : [];
  });
  return [`${titles[command] ?? command} complete`, ...items, ...(files.length ? files : ['no file changes'])].join(' · ');
}

// Inject the terminal boundary so validation, cancellation and selection can be tested without a TTY.
type PromptUI = Pick<typeof prompts, 'intro' | 'select' | 'text' | 'confirm' | 'multiselect' | 'note' | 'outro' | 'cancel'> & { bar: () => ProgressBar };

export class InteractiveFlow {
  constructor(private readonly ui: PromptUI = { ...prompts, bar: () => createBar() }) {}

  start(command: string): void { this.ui.intro(`Agent Stuff · ${command}`); }
  cancel(): void { this.ui.cancel('Cancelled. No files changed.'); }

  async harness(): Promise<string> {
    return answer(await this.ui.select({ message: 'Which AI tool do you use?',
      options: adapters.map(a => ({ value: a.id, label: harnessNames[a.id] })),
    }));
  }

  async scope(): Promise<string> {
    return answer(await this.ui.select({ message: 'Where should this be installed?', options: [
      { value: 'project', label: 'One project', hint: 'Choose an existing project directory' },
      { value: 'global', label: 'Globally', hint: 'Available across your projects' },
    ] }));
  }

  async project(source: string): Promise<string> {
    while (true) {
      const value = answer(await this.ui.text({ message: 'Project directory',
        placeholder: '/path/to/your/project (~/ is supported)', validate: validateProject,
      }));
      const directory = projectPath(value);
      if (realpathSync(directory) === realpathSync(source)) {
        const proceed = answer(await this.ui.confirm({
          message: 'This is the Agent Stuff source checkout. Install into this checkout?', initialValue: false,
        }));
        if (!proceed) continue;
      }
      return directory;
    }
  }

  async assets(catalog: Map<string, Asset>, adapter: Adapter): Promise<string[]> {
    const options = Object.entries(assetOptions(catalog, adapter)).flatMap(([group, items]) =>
      items.map(item => ({ ...item, label: `${group.split(' · ')[0]} › ${item.label}` })));
    return answer(await this.ui.multiselect({
      message: 'Choose what to install (Space to toggle, A to select all, Enter to continue)',
      options, initialValues: [], required: true, maxItems: 12,
    }));
  }

  compatibility(results: Compatibility[]): void {
    this.ui.note(formatCompatibility(results, (process.stdout.columns ?? 100) - 6), 'Compatibility');
  }

  preview(plan: Plan): void {
    const counts = new Map<string, number>();
    for (const change of plan.changes) counts.set(change.action, (counts.get(change.action) ?? 0) + 1);
    this.ui.note([
      `Target: ${plan.context.target}`,
      [...counts].map(([action, count]) => `${count} ${action}`).join(' · '),
      '',
      ...plan.changes.map(c => `${c.action}  ${c.path}`),
    ].join('\n'), 'Review changes');
  }

  previewComplete(): void { this.ui.outro('Preview only. No files changed.'); }

  async confirm(message: string, initialValue = true): Promise<void> {
    if (!answer(await this.ui.confirm({ message, initialValue }))) throw new Cancelled();
  }

  async apply(command: string, plan: Plan, operation: () => Promise<void>, fillMs = 900): Promise<void> {
    const bar = this.ui.bar();
    const messages: Record<string, string> = { install: 'Installing selected items', update: 'Updating installed items', uninstall: 'Removing installed items' };
    const interrupt = () => {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
      bar.error('Operation interrupted. Run recover before retrying.');
      process.kill(process.pid, 'SIGINT');
    };
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', interrupt);
    bar.start(messages[command] ?? 'Applying changes');
    const filling = this.fill(bar, fillMs);
    try {
      await operation();
      await filling;
      bar.stop(completionSummary(command, plan));
    } catch (error) {
      bar.error('Could not apply changes');
      throw error;
    } finally {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
    }
  }

  // Animate the bar left to right with an ease-out so a fast install still reads as work.
  private fill(bar: ProgressBar, duration: number): Promise<void> {
    if (duration <= 0) { bar.update(1); return Promise.resolve(); }
    return new Promise<void>(resolve => {
      const started = Date.now();
      const timer = setInterval(() => {
        const fraction = Math.min(1, (Date.now() - started) / duration);
        const eased = 1 - Math.pow(1 - fraction, 3);
        bar.update(eased);
        if (fraction >= 1) { clearInterval(timer); resolve(); }
      }, 50);
    });
  }

  complete(command: string, plan: Plan, scope: string | undefined, project: string, selectedKeys: string[]): void {
    if (command === 'install') {
      const key = selectedKeys.find(k => k.startsWith('skill/')) ?? selectedKeys[0];
      const [kind, id] = key?.split('/') ?? [];
      const tool = harnessNames[plan.context.adapter];
      const location = scope === 'project' ? path.resolve(project) : 'your project';
      const next = kind === 'agent' ? `Select the ${id} agent.`
        : kind === 'command' || (kind === 'skill' && plan.context.adapter === 'claude-code') ? `Run /${id}.`
        : `Ask: Use ${id} to help with your task.`;
      this.ui.note(`Location: ${plan.context.target}\n\nOpen ${tool} in ${location}.\n${next}`, 'Next step');
      this.ui.outro('Ready to use.');
    } else {
      this.ui.outro(`Location: ${plan.context.target}`);
    }
  }
}
