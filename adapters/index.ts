import { opencode } from './opencode/index.js';
import { codex } from './codex/index.js';
import { claudeCode } from './claude-code/index.js';
import type { Adapter } from './types.js';
export { adapterIds } from './types.js';
export type { Adapter, AdapterId, Compatibility, CompatibilityIssue, OutputFile } from './types.js';
export { defineAdapter, AdapterContractError, compatibility, issue } from './runtime.js';
export type { AdapterImplementation } from './runtime.js';
export const adapters: Adapter[] = [opencode, codex, claudeCode];
export function getAdapter(id: string): Adapter {
  const adapter = adapters.find(a => a.id === id);
  if (!adapter) throw new Error(`Unknown adapter: ${id}. Choose ${adapters.map(a => a.id).join(', ')}`);
  return adapter;
}
