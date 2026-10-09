import { getContract, type Asset, type CoreContract, type CoreSchema, type StuffKind } from '../core/src/index.js';
import type { Adapter, Compatibility, CompatibilityIssue } from './types.js';

// Pin the field vocabulary understood by these adapters; do not derive it from
// an upgraded core at module load time, which would silently accept new fields.
const common = ['schema_version', 'kind', 'id', 'description', 'display_name', 'short_description'];
const content = ['instructions', 'resources'];
const expectedFields: Record<StuffKind, readonly string[]> = {
  skill: [...common, ...content, 'activation', 'argument_hint'],
  command: [...common, 'workflow', 'argument_hint'],
  agent: [...common, ...content, 'role', 'policy', 'policy.workspace_read', 'policy.workspace_write',
    'policy.shell', 'policy.questions', 'policy.delegation', 'policy.delegation_targets', 'policy.write_paths'],
};

export class AdapterContractError extends Error {
  constructor(public readonly adapter: string, public readonly expected: readonly number[],
    public readonly actual: number, detail = 'Unsupported contract version') {
    super(`${adapter}: ${detail}; expected core contract [${expected.join(', ')}], actual ${actual}`);
    this.name = 'AdapterContractError';
  }
}

export type AdapterImplementation = Pick<Adapter, 'id' | 'version' | 'directories' | 'supportedContractVersions' | 'check' | 'render'> & {
  /** Fields consumed by validation/rendering, including identity/content paths. */
  mappedFields: Partial<Record<StuffKind, readonly string[]>>;
};

export function issue(field: string, status: CompatibilityIssue['status'], reason: string, effect: string): CompatibilityIssue {
  return { field, status, reason, effect };
}

export function compatibility(asset: Asset, supportedReason: string, issues: CompatibilityIssue[] = []): Compatibility {
  const status = issues.some(i => i.status === 'unsupported') ? 'unsupported'
    : issues.length ? 'limited' : 'supported';
  return { asset: asset.key, status, reason: issues.length ? issues.map(i => `${i.field}: ${i.reason}`).join('; ') : supportedReason, issues };
}

function assertContract(adapter: AdapterImplementation, contract: CoreContract): void {
  const fail = (detail: string): never => { throw new AdapterContractError(adapter.id, adapter.supportedContractVersions, contract.contractVersion, detail); };
  if (!adapter.supportedContractVersions.includes(contract.contractVersion)) fail('Unsupported contract version');
  if (contract.definitionSchemaVersion !== 1) fail(`Unsupported definition schema ${contract.definitionSchemaVersion}`);
  if (Object.keys(contract.kinds).sort().join(',') !== Object.keys(expectedFields).sort().join(',')) fail('Core stuff kinds changed');
  for (const kind of Object.keys(expectedFields) as StuffKind[]) {
    for (const fields of [Object.keys(contract.kinds[kind].fields), schemaFields(contract.kinds[kind].schema)]) {
      const unknown = fields.filter(f => !expectedFields[kind].includes(f));
      const missing = expectedFields[kind].filter(f => !fields.includes(f));
      if (unknown.length || missing.length) fail(`Core ${kind} fields changed (unknown: ${unknown.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'})`);
    }
  }
}

function schemaFields(schema: CoreSchema, prefix = ''): string[] {
  return Object.entries(schema.properties ?? {}).flatMap(([name, property]) => {
    const key = prefix + name;
    return [key, ...schemaFields(property, `${key}.`)];
  });
}

function presentFields(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([name, item]) => {
    if (item === undefined) return [];
    const key = prefix + name;
    return [key, ...(item && typeof item === 'object' && !Array.isArray(item) ? presentFields(item, `${key}.`) : [])];
  });
}

/** Every public check/render goes through the same version and field guards. */
export function defineAdapter(implementation: AdapterImplementation, readContract: () => CoreContract = getContract): Adapter {
  const spec = { ...implementation, supportedContractVersions: Object.freeze([...implementation.supportedContractVersions]) };
  const check: Adapter['check'] = (asset, catalog) => {
    const contract = readContract();
    assertContract(spec, contract);
    const kind = asset.definition.kind;
    if (!Object.hasOwn(contract.kinds, kind)) return compatibility(asset, '', [
      issue('kind', 'unsupported', `Unknown stuff kind: ${kind}`, 'Rendering is blocked.'),
    ]);
    const fields = presentFields(asset.definition);
    const unknown = fields.filter(f => !Object.hasOwn(contract.kinds[kind].fields, f));
    if (unknown.length) return compatibility(asset, '', unknown.map(field => issue(field, 'unsupported',
      'Field is not understood by this core contract/adapter.', 'Rendering is blocked; the field will not be silently discarded.')));
    const result = spec.check(asset, catalog);
    if (result.status === 'unsupported') return result;
    const mapped = spec.mappedFields[kind] ?? [];
    const omitted = fields.filter(f => !mapped.includes(f)).map(field => {
      const metadata = contract.kinds[kind].fields[field]!.category === 'metadata';
      return issue(field, metadata ? 'limited' : 'unsupported', 'This adapter does not map this field.',
        metadata ? 'The supplied display/input hint metadata is omitted from installed files.'
          : 'Required content or behavior cannot be preserved; installation is blocked.');
    });
    return compatibility(asset, result.reason, [...result.issues, ...omitted]);
  };
  const adapter: Adapter = { id: spec.id, version: spec.version, directories: Object.freeze({ ...spec.directories }),
    supportedContractVersions: spec.supportedContractVersions, check,
    render(asset, catalog) {
      const result = check(asset, catalog);
      if (result.status === 'unsupported') throw new Error(`Cannot render ${asset.key}: ${result.reason}`);
      return spec.render(asset, catalog);
    },
  };
  return Object.freeze(adapter);
}
