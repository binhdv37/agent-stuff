import { loadCatalogRoot } from '../../tool/src/core/load.js';
import type { Asset } from '../../tool/src/core/schema.js';
import { getContract } from './contract.js';

export { getContract } from './contract.js';
export type { CoreContract, CoreSchema, KindContract, StuffKind, FieldCategory, FieldMeaning } from './contract.js';
export type { Definition, Asset } from '../../tool/src/core/schema.js';
export type Catalog = Map<string, Asset>;
export type DocsTopic = 'concepts' | 'format' | 'fields' | 'api';
export type CoreErrorCode = 'CATALOG_INVALID' | 'UNKNOWN_DOCS_TOPIC';
type SchemaNode = {
  properties?: Record<string, SchemaNode>; required?: string[]; default?: unknown;
  type?: string; const?: unknown; enum?: unknown[];
};

export class CoreError extends Error {
  constructor(public readonly code: CoreErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CoreError';
  }
}

/** Explicit core root: no cwd, personal configuration or bundled-source fallback. */
export async function loadCatalog(coreRoot: string): Promise<Catalog> {
  try { return await loadCatalogRoot(coreRoot); }
  catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new CoreError('CATALOG_INVALID', `Cannot load core catalog at ${coreRoot}: ${detail}`, { cause });
  }
}

const docs: Record<Exclude<DocsTopic, 'fields'>, string> = {
  concepts: `# Concepts core

Stuff là thành phần portable có nội dung, cấu hình và contract riêng.
i-skill là workflow/năng lực tái sử dụng. i-command là prompt/điểm gọi chủ động;
schema v1 chỉ hỗ trợ tham chiếu workflow skill. i-agent định nghĩa vai trò,
cách làm việc và policy thực thi. Tên tương tự trong harness không đảm bảo cùng nghĩa.

Core sở hữu ý nghĩa. Adapter dịch sang cơ chế native và báo mức tương thích.
Installer quản lý preview, conflict, thay đổi file và recovery. Harness chạy
workflow đã cài. Persona/hướng dẫn không thay thế cơ chế enforcement quyền.
`,
  format: `# Format core

Core root chứa skills/<id>/, agents/<id>/ và commands/<id>/.
Mỗi asset có definition.yaml với schema_version: 1, kind, id, description.
Skill/agent tham chiếu file instructions UTF-8 không rỗng và khai báo resources.
Command tham chiếu workflow: skill/<id>; không có instructions/resources riêng.
Full key là kind/id, directory và id phải khớp. File resource giữ nguyên byte.
Các file API/docs nằm ngoài ba thư mục catalog và không được nạp thành asset.

getContract() trả schema cấu trúc và rules; loadCatalog(coreRoot) kiểm tra thêm
custom refinements, file/resource, identity và quan hệ giữa các stuff.
`,
  api: `# API core v1

Import public entrypoint core/src/index.ts (ESM đã build: dist/core/src/index.js).
getContract(): CoreContract — snapshot JSON với contractVersion,
definitionSchemaVersion, kinds[kind].schema, kinds[kind].fields và rules.
getDocs(topic: DocsTopic): string — Markdown; topics: concepts, format, fields, api.
loadCatalog(coreRoot: string): Promise<Catalog> — nhận core root tường minh,
trả Map full key → Asset; mỗi Asset có key, definition đã áp dụng defaults,
body UTF-8 (command là chuỗi rỗng), resources Map đường dẫn → Buffer.
Không tự chọn cwd/home/source mặc định. CLI giữ --source checkout riêng.

CoreError có code CATALOG_INVALID hoặc UNKNOWN_DOCS_TOPIC; lỗi catalog có cause
và message giữ ngữ cảnh lỗi gốc. Không phụ thuộc consumer parse message.
Schema JSON không thay thế validate đầy đủ của loader.

Bước 1: facade còn dùng schema/loader trong tool/src/core; bước 2 sẽ di chuyển
ownership, bỏ phụ thuộc này. Chưa expose package npm hoặc wiring adapter mới.
`,
};

/** Field reference is rendered from the same snapshot exposed to consumers. */
export function getDocs(topic: DocsTopic): string {
  if (topic === 'fields') {
    const contract = getContract();
    const sections = Object.entries(contract.kinds).map(([kind, value]) => {
      const rows = Object.entries(value.fields).map(([name, meaning]) => {
        const schema = value.schema as SchemaNode;
        const [parent, child] = name.split('.');
        const container = child ? schema.properties![parent!]! : schema;
        const property = container.properties![child ?? parent!]!;
        const required = container.required?.includes(child ?? parent!) ? 'có' : 'không';
        const fallback = 'default' in property ? JSON.stringify(property.default) : '—';
        const type = property.const !== undefined ? JSON.stringify(property.const)
          : property.enum ? property.enum.join(' / ') : property.type;
        return `| ${name} | ${type} | ${required} | ${fallback} | ${meaning.category} | ${meaning.description} |`;
      });
      return `## ${kind}\n\n| Field | Kiểu/giá trị | Bắt buộc ở input | Mặc định | Nhóm | Ý nghĩa |\n|---|---|---|---|---|---|\n${rows.join('\n')}`;
    });
    return `# Field reference — contract ${contract.contractVersion}\n\n${sections.join('\n\n')}\n\n## Ràng buộc\n\n${contract.rules.map(rule => `- ${rule}`).join('\n')}\n`;
  }
  if (Object.hasOwn(docs, topic)) return docs[topic];
  throw new CoreError('UNKNOWN_DOCS_TOPIC', `Unknown core docs topic: ${String(topic)}`);
}
