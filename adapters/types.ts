import type { Asset } from '../core/src/index.js';
export const adapterIds = ['opencode', 'codex', 'claude-code'] as const;
export type AdapterId = typeof adapterIds[number];
export type CompatibilityIssue = {
  field: string; status: 'limited' | 'unsupported'; reason: string; effect: string;
};
export type Compatibility = {
  asset: string; status: 'supported' | 'limited' | 'unsupported'; reason: string;
  issues: CompatibilityIssue[];
};
export type OutputFile = { asset: string; path: string; content: Buffer };
export interface Adapter {
  id: AdapterId;
  version: number;
  supportedContractVersions: readonly number[];
  directories: { global: string; project: string };
  check(asset: Asset, catalog: Map<string, Asset>): Compatibility;
  render(asset: Asset, catalog: Map<string, Asset>): OutputFile[];
}
