import { readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { definitionSchema, type Asset } from './schema.js';
import { assertNoSymlinks, inside } from './paths.js';

export async function loadCore(source: string): Promise<Map<string, Asset>> {
  const root = await realpath(path.join(source, 'core'));
  const assets = new Map<string, Asset>();
  for (const kind of ['skill', 'agent', 'command'] as const) {
    const directory = path.join(root, `${kind}s`);
    await assertNoSymlinks(directory);
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) throw new Error(`Expected asset directory: ${directory}/${entry.name}`);
      const assetRoot = path.join(directory, entry.name);
      const file = path.join(assetRoot, 'definition.yaml');
      try {
        await assertNoSymlinks(file);
        const definition = definitionSchema.parse(parse(await readFile(file, 'utf8')));
        if (definition.kind !== kind || definition.id !== entry.name) throw new Error('Kind or ID does not match directory');
        const key = `${kind}/${definition.id}`;
        if (assets.has(key)) throw new Error(`Duplicate asset: ${key}`);
        let body = '';
        const resources = new Map<string, Buffer>();
        if (definition.kind !== 'command') {
          const instructions = inside(assetRoot, definition.instructions);
          await assertNoSymlinks(instructions);
          body = await readFile(instructions, 'utf8');
          if (!body.trim()) throw new Error('Instructions must not be empty');
          for (const resource of definition.resources) {
            if (['definition.yaml', 'SKILL.md', definition.instructions].includes(resource)) {
              throw new Error(`Reserved resource path: ${resource}`);
            }
            const resourceFile = inside(assetRoot, resource);
            await assertNoSymlinks(resourceFile);
            resources.set(resource, await readFile(resourceFile));
          }
        }
        assets.set(key, { key, definition, body, resources });
      } catch (error) { throw new Error(`${file}: ${(error as Error).message}`); }
    }
  }
  if (!assets.size) throw new Error(`No assets found in ${root}`);
  for (const asset of assets.values()) {
    if (asset.definition.kind === 'command' && !assets.has(asset.definition.workflow)) {
      throw new Error(`${asset.key}: missing workflow ${asset.definition.workflow}`);
    }
  }
  return assets;
}

export function selectAssets(assets: Map<string, Asset>, only?: string[]): Asset[] {
  const selected = only ?? [...assets.keys()];
  if (!selected.length) throw new Error('Select at least one asset');
  return [...new Set(selected)].map(key => {
    const asset = assets.get(key);
    if (!asset) throw new Error(`Unknown asset: ${key}`);
    return asset;
  });
}
