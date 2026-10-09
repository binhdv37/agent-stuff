import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { adapterIds, type AdapterId } from '../../../adapters/index.js';
import { assertNoSymlinks, loadCatalog } from '../../../core/src/index.js';
import { fingerprint, inspect, report } from './index.js';

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    source: { type: 'string', default: '.' }, asset: { type: 'string' }, harness: { type: 'string' },
    check: { type: 'boolean' }, 'require-passed': { type: 'boolean' },
  } });
  const command = positionals[0] ?? 'validate';
  if (positionals.length > 1 || !['validate', 'report', 'fingerprint'].includes(command)) throw new Error('Use validate, report [--check], or fingerprint --asset kind/id --harness id');
  if (values.check && command !== 'report') throw new Error('--check is only valid for report');
  if (values['require-passed'] && command !== 'validate') throw new Error('--require-passed is only valid for validate');
  if ((values.asset || values.harness) && command !== 'fingerprint' && !values['require-passed']) {
    throw new Error('--asset and --harness are only valid with fingerprint or validate --require-passed');
  }
  const source = await realpath(values.source!);
  if (command === 'fingerprint' || values['require-passed']) {
    if (!values.asset || !values.harness || !adapterIds.includes(values.harness as AdapterId)) throw new Error('Specify --asset kind/id and --harness opencode|codex|claude-code');
  }
  if (command === 'fingerprint') {
    console.log(JSON.stringify(await fingerprint(source, await loadCatalog(path.join(source, 'core')), values.asset!, values.harness as AdapterId), null, 2));
    return;
  }
  const rows = await inspect(source);
  if (command === 'report') {
    const destination = path.join(source, 'docs/verification/README.md');
    await assertNoSymlinks(destination);
    const markdown = report(rows);
    if (values.check) {
      if (await readFile(destination, 'utf8') !== markdown) throw new Error('Verification summary is out of date; run report');
      console.log('Verification summary is current');
    } else {
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, markdown);
      console.log(`Wrote ${destination}`);
    }
  } else {
    if (values['require-passed']) {
      const row = rows.find(r => r.asset === values.asset && r.harness === values.harness);
      if (!row || row.status !== 'passed' || row.stale) throw new Error(`Target is not currently verified: ${values.asset} on ${values.harness}`);
    }
    console.log(`Validated verification records for ${rows.length} asset/harness pairs. This validates records, not runtime behavior.`);
  }
}
main().catch(error => { console.error((error as Error).message); process.exitCode = 1; });
