import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { adapterIds, type AdapterId } from '../../../adapters/index.js';
import { assertNoSymlinks, loadCatalog } from '../../../core/src/index.js';
import { fingerprint, inspect, report } from './index.js';

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    source: { type: 'string', default: '.' }, asset: { type: 'string' }, harness: { type: 'string' },
    check: { type: 'boolean' },
  } });
  const command = positionals[0] ?? 'validate';
  if (positionals.length > 1 || !['validate', 'report', 'fingerprint'].includes(command)) {
    throw new Error('Use validate, report [--check], or fingerprint --asset kind/id --harness id');
  }
  if (values.check && command !== 'report') throw new Error('--check is only valid for report');
  if ((values.asset || values.harness) && command !== 'fingerprint') {
    throw new Error('--asset and --harness are only valid with fingerprint');
  }
  const source = await realpath(values.source!);
  if (command === 'fingerprint') {
    if (!values.asset || !values.harness || !adapterIds.includes(values.harness as AdapterId)) {
      throw new Error('Specify --asset kind/id and --harness opencode|codex|claude-code');
    }
    const catalog = await loadCatalog(path.join(source, 'core'));
    console.log(JSON.stringify({ fingerprint: fingerprint(catalog, values.asset, values.harness as AdapterId) }, null, 2));
    return;
  }
  const rows = await inspect(source);
  if (command === 'report') {
    const destination = path.join(source, 'verification/README.md');
    await assertNoSymlinks(destination);
    const markdown = report(rows);
    if (values.check) {
      if (await readFile(destination, 'utf8') !== markdown) throw new Error('Owner-testing summary is out of date; run report');
      console.log('Owner-testing summary is current');
    } else {
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, markdown);
      console.log(`Wrote ${destination}`);
    }
  } else {
    console.log(`Validated ${rows.length} owner-testing records. This validates data, not owner confirmation or model behavior.`);
  }
}
main().catch(error => { console.error((error as Error).message); process.exitCode = 1; });
