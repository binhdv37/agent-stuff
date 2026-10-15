import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const stateFile = new URL('dist/.build-state.json', root);
const inputs = ['core/', 'adapters/', 'tool/', 'tests/', 'scripts/build.mjs', 'scripts/build-cache.mjs',
  'tsconfig.json', 'package.json', 'package-lock.json'];
const outputs = ['dist/core/', 'dist/adapters/', 'dist/tool/', 'dist/tests/'];

async function fingerprint(paths) {
  const hash = createHash('sha256');
  async function visit(relative) {
    const url = new URL(relative, root);
    if (relative.endsWith('/')) {
      let entries;
      try { entries = await readdir(url, { withFileTypes: true }); }
      catch (error) { if (error.code === 'ENOENT') { hash.update(`missing:${relative}\0`); return; } throw error; }
      hash.update(`directory:${relative}\0`);
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        await visit(`${relative}${entry.name}${entry.isDirectory() ? '/' : ''}`);
      }
    } else {
      let content;
      try { content = await readFile(url); }
      catch (error) { if (error.code === 'ENOENT') { hash.update(`missing:${relative}\0`); return; } throw error; }
      hash.update(`${relative}\0${content.length}\0`).update(content);
    }
  }
  for (const relative of paths) await visit(relative);
  return hash.digest('hex');
}

export async function recordBuild() {
  await writeFile(stateFile, JSON.stringify({ inputs: await fingerprint(inputs), outputs: await fingerprint(outputs) }) + '\n');
}

async function current() {
  try {
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    return state.inputs === await fingerprint(inputs) && state.outputs === await fingerprint(outputs);
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return false;
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await current() ? 0 : 1;
