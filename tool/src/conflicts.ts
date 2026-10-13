import type { Change } from './installation/index.js';

export function formatConflict(change: Extract<Change, { action: 'conflict' }>, command: string): string {
  const lines = [`! Conflict: ${change.path}`, `  Item: ${change.asset}`];
  switch (change.conflict.reason) {
    case 'modified':
      lines.push('  Modified since installation.',
        '  To keep your edits, move this file outside the target directory.',
        '  Or restore its original installed contents.');
      break;
    case 'unmanaged':
      lines.push('  An existing file is not managed by this installer.',
        '  Move this file outside the target directory to preserve it.');
      break;
    case 'other-asset':
      lines.push(`  Tracked by another item: ${change.conflict.owner}.`,
        `  Remove the recorded owner with uninstall --only ${change.conflict.owner} before retrying.`);
      break;
  }
  lines.push(`  Then re-run ${command}.`);
  if (command === 'uninstall' && change.conflict.reason === 'modified') {
    lines.push('  To remove other items first, select them with --only skill/<id>, agent/<id> or command/<id>.');
  }
  return lines.join('\n');
}
