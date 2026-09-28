import { stringify } from 'yaml';
import type { Asset } from './core/schema.js';
import type { OutputFile } from './adapter.js';
export const explicitGuard = 'Do not invoke automatically. Use this skill only when the user explicitly requests this workflow or names the skill.';
export function description(asset: Asset): string {
  const d = asset.definition;
  return d.kind === 'skill' && d.activation === 'explicit' && !d.description.includes(explicitGuard)
    ? `${d.description} ${explicitGuard}` : d.description;
}
export function markdown(metadata: object, body: string): Buffer {
  return Buffer.from(`---\n${stringify(metadata)}---\n\n${body}`);
}
export function skillFiles(asset: Asset, metadata: object): OutputFile[] {
  return [
    { asset: asset.key, path: `skills/${asset.definition.id}/SKILL.md`, content: markdown(metadata, asset.body) },
    ...[...asset.resources].map(([name, content]) => ({ asset: asset.key, path: `skills/${asset.definition.id}/${name}`, content })),
  ];
}
