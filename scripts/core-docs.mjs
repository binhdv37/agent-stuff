import { readFile, writeFile } from 'node:fs/promises';
import { getDocs } from '../dist/core/src/index.js';

const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => arg !== '--check')) {
  throw new Error('Usage: npm run core:docs -- [--check]; build first');
}
const destination = new URL('../core/docs/fields.md', import.meta.url);
const markdown = getDocs('fields');
if (args.includes('--check')) {
  if (await readFile(destination, 'utf8') !== markdown) {
    throw new Error('Core field reference is stale; run npm run core:docs');
  }
  console.log('Core field reference is current');
} else {
  await writeFile(destination, markdown);
  console.log('Wrote core/docs/fields.md');
}
