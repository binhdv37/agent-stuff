import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { relativePath } from './schema.js';

export function inside(root: string, relative: string): string {
  relativePath.parse(relative);
  return path.join(path.resolve(root), relative);
}

// Check every ancestor, including an existing root. Never follow destination symlinks.
export async function assertNoSymlinks(file: string): Promise<void> {
  const absolute = path.resolve(file);
  const { root } = path.parse(absolute);
  let current = root;
  for (const segment of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error(`Symlink not allowed: ${current}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }
}
