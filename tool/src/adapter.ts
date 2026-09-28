import type { Asset } from './core/schema.js';
export const adapterIds = ['opencode', 'codex', 'claude-code'] as const;
export type AdapterId = typeof adapterIds[number];
export type Compatibility = { asset: string; status: 'supported' | 'limited' | 'unsupported'; reason: string };
export type OutputFile = { asset: string; path: string; content: Buffer };
export interface Adapter {
  id: AdapterId;
  version: number;
  directories: { global: string; project: string };
  check(asset: Asset, catalog: Map<string, Asset>): Compatibility;
  render(asset: Asset, catalog: Map<string, Asset>): OutputFile[];
}
