import { readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { definitionSchema, type Asset } from './schema.js';
import { assertNoSymlinks, inside } from './paths.js';

export async function loadCatalogRoot(coreRoot: string): Promise<Map<string, Asset>> {
  const root = await realpath(coreRoot);
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
    for (const companion of asset.definition.install_with) {
      if (companion === asset.key) throw new Error(`${asset.key}: install_with cannot reference self`);
      if (!assets.has(companion)) throw new Error(`${asset.key}: missing install_with reference ${companion}`);
    }
    if (asset.definition.kind === 'command' && !assets.has(asset.definition.workflow)) {
      throw new Error(`${asset.key}: missing workflow ${asset.definition.workflow}`);
    }
    if (asset.definition.kind === 'agent') {
      const { policy } = asset.definition;
      if (policy.write_paths.length && policy.workspace_write === 'allow') {
        throw new Error(`${asset.key}: scoped write_paths cannot accompany unrestricted workspace_write`);
      }
      if (policy.delegation === 'allow' && !policy.delegation_targets.length) {
        throw new Error(`${asset.key}: delegation requires at least one target`);
      }
      if (policy.delegation !== 'allow' && policy.delegation_targets.length) {
        throw new Error(`${asset.key}: delegation targets require delegation: allow`);
      }
      for (const target of policy.delegation_targets) {
        const delegate = assets.get(target);
        if (!delegate || delegate.definition.kind !== 'agent' || delegate.definition.role !== 'delegated') {
          throw new Error(`${asset.key}: missing delegated agent ${target}`);
        }
        const restricted = delegate.definition.policy;
        if (restricted.workspace_write !== 'deny' || restricted.write_paths.length ||
            restricted.shell !== 'deny' || restricted.delegation !== 'deny') {
          throw new Error(`${asset.key}: delegate ${target} must be read-only without shell or further delegation`);
        }
      }
    }
  }
  return assets;
}

export type Selection = { assets: Asset[]; requested: string[]; companions: { key: string; from: string[] }[] };

export function resolveSelection(assets: Map<string, Asset>, only?: string[], includeCompanions = true): Selection {
  const selected = only ?? [...assets.keys()];
  if (!selected.length) throw new Error('Select at least one asset');
  const result = new Map<string, Asset>();
  const origins = new Map<string, Set<string>>();
  const visit = (key: string) => {
    const asset = assets.get(key);
    if (!asset) throw new Error(`Unknown asset: ${key}`);
    if (result.has(key)) return;
    result.set(key, asset);
    for (const target of asset.definition.install_with) {
      if (!origins.has(target)) origins.set(target, new Set());
      origins.get(target)!.add(key);
      if (includeCompanions) visit(target);
    }
  };
  for (const key of selected) visit(key);
  return { assets: [...result.values()], requested: [...new Set(selected)],
    companions: [...origins].filter(([key]) => !selected.includes(key)).map(([key, from]) => ({ key, from: [...from] })) };
}

export function selectAssets(assets: Map<string, Asset>, only?: string[], includeCompanions = true): Asset[] {
  return resolveSelection(assets, only, includeCompanions).assets;
}
