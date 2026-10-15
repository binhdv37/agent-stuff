import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

export const packageSourceSchema = z.strictObject({
  kind: z.literal('package'), name: z.string().min(1), version: z.string().min(1),
});
export type Source = string | z.infer<typeof packageSourceSchema>;

export function formatSource(source: Source): string {
  return typeof source === 'string' ? source : `${source.name}@${source.version}`;
}

export async function resolveSource(bundledRoot: string, override?: string, recorded?: Source): Promise<{ root: string; source: Source }> {
  if (override !== undefined || typeof recorded === 'string') {
    const root = path.resolve(override ?? (recorded as string));
    return { root, source: root };
  }
  // The npm files allowlist excludes tool sources. This distinguishes a package
  // from a built checkout without depending on npm's cache layout or environment.
  let checkout = false;
  try { checkout = (await lstat(path.join(bundledRoot, 'tool/src/cli.ts'))).isFile(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (checkout) {
    if (recorded) throw new Error(`This installation uses ${formatSource(recorded)}. Run npx ${recorded.name}@latest update, or pass --source <directory> to explicitly switch to a local source.`);
    return { root: bundledRoot, source: bundledRoot };
  }
  const { name, version } = JSON.parse(await readFile(path.join(bundledRoot, 'package.json'), 'utf8'));
  const metadata = packageSourceSchema.parse({ kind: 'package', name, version });
  if (recorded && recorded.name !== metadata.name) throw new Error(`Installation source is ${recorded.name}; this CLI belongs to ${metadata.name}. Invoke the recorded package or pass --source <directory>.`);
  return { root: bundledRoot, source: metadata };
}
