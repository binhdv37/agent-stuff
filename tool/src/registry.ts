import { opencode } from '../../adapters/opencode/index.js';
import { codex } from '../../adapters/codex/index.js';
import { claudeCode } from '../../adapters/claude-code/index.js';
import type { Adapter } from './adapter.js';
export const adapters: Adapter[] = [opencode, codex, claudeCode];
export function getAdapter(id: string): Adapter {
  const adapter = adapters.find(a => a.id === id);
  if (!adapter) throw new Error(`Unknown adapter: ${id}. Choose ${adapters.map(a => a.id).join(', ')}`);
  return adapter;
}
