import { loadCatalogRoot } from './catalog.js';
import type { Asset } from './schema.js';
import { CoreError } from './errors.js';

export { getContract } from './contract.js';
export type { CoreContract, CoreSchema, KindContract, StuffKind, FieldCategory, FieldMeaning } from './contract.js';
export type { Definition, Asset } from './schema.js';
export { definitionSchema, relativePath } from './schema.js';
export { selectAssets } from './catalog.js';
export { inside, assertNoSymlinks } from './paths.js';
export { getDocs } from './docs.js';
export type { DocsTopic } from './docs.js';
export { CoreError } from './errors.js';
export type { CoreErrorCode } from './errors.js';
export type Catalog = Map<string, Asset>;

/** Explicit core root: no cwd, personal configuration or bundled-source fallback. */
export async function loadCatalog(coreRoot: string): Promise<Catalog> {
  try { return await loadCatalogRoot(coreRoot); }
  catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new CoreError('CATALOG_INVALID', `Cannot load core catalog at ${coreRoot}: ${detail}`, { cause });
  }
}
