import { cp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Remove compiler output so moved/deleted modules cannot survive in npm packs.
// Preserve other dist previews: only these directories are TypeScript output.
for (const directory of ['core', 'tool', 'adapters', 'tests']) {
  await rm(new URL(`../dist/${directory}/`, import.meta.url), { recursive: true, force: true });
}
const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc'], {
  cwd: root, stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
if (process.exitCode === 0) {
  await cp(new URL('../core/docs/', import.meta.url), new URL('../dist/core/docs/', import.meta.url), { recursive: true });
}
