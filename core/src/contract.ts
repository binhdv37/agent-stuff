import { z } from 'zod';
import { definitionSchema, type FieldCategory, type FieldMeaning } from './schema.js';
export type { FieldCategory, FieldMeaning } from './schema.js';

export type StuffKind = 'skill' | 'agent' | 'command';
/** JSON Schema snapshot; unknown keywords remain available without exposing Zod types. */
export type CoreSchema = {
  [keyword: string]: unknown;
  properties?: Record<string, CoreSchema>;
  required?: string[];
  default?: unknown;
  additionalProperties?: boolean;
};
export type KindContract = {
  schema: CoreSchema;
  fields: Record<string, FieldMeaning>;
};
export type CoreContract = {
  contractVersion: number;
  definitionSchemaVersion: number;
  kinds: Record<StuffKind, KindContract>;
  rules: string[];
};

const rules = [
  'Schema là JSON Schema draft 2020-12 cho input YAML: required/default/type/enum được lấy từ validator hiện có. Unknown field bị từ chối ở cả definition và policy.',
  'JSON Schema không diễn đạt hết custom refinements, filesystem và quan hệ catalog. loadCatalog là bước validate đầy đủ; không dùng schema JSON để thay loader.',
  'Đường dẫn tương đối được chuẩn hóa: không rỗng, không tuyệt đối, không backslash/colon/NUL, không segment rỗng/dot/dot-dot. Resource và instructions phải tồn tại và không qua symlink.',
  'resources không trùng; instructions không rỗng; kind/id khớp thư mục; catalog không rỗng; workflow và delegation_targets phải tham chiếu đúng loại.',
  'write_paths khác rỗng không đi cùng workspace_write: allow. delegation_targets chỉ có khi delegation: allow, và allow cần ít nhất một target chỉ đọc, không shell, không delegation.',
  'Policy cần enforcement. Nếu shell làm mất giới hạn ghi, adapter phải chặn tổ hợp đó; đây là kiểm tra tương thích harness, không phải điều kiện để YAML hợp lệ.',
  'metadata chỉ tác động hiển thị; content cần giữ nội dung và tài nguyên; behavior điều khiển cách dùng; enforcement cần cơ chế quyền. structure xác định format/identity. Category không tự quyết định một field được bỏ qua hay không.',
  'Không hiểu field ảnh hưởng hành vi thì chặn. Metadata hiển thị thiếu mapping có thể limited với báo cáo rõ. Nội dung hoặc quyền bắt buộc không bảo toàn được thì unsupported; không thay bằng lời nhắc.',
  'Contract version độc lập với schema_version YAML và revision adapter. Thay đổi API public, schema, default, ngữ nghĩa hoặc ràng buộc phải tăng contract version; chỉnh chính tả/diễn đạt không đổi nghĩa thì không. Adapter phải khai báo version hiểu được và từ chối version không hỗ trợ.',
];

function fieldMeanings(schema: CoreSchema, prefix = ''): Record<string, FieldMeaning> {
  const fields: Record<string, FieldMeaning> = {};
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    const key = prefix + name;
    const category = property['x-core-category'] as FieldCategory | undefined;
    if (typeof property.description !== 'string' || !category ||
        !['structure', 'metadata', 'content', 'behavior', 'enforcement'].includes(category)) {
      throw new Error(`Missing core field metadata: ${key}`);
    }
    fields[key] = { category, description: property.description };
    Object.assign(fields, fieldMeanings(property, `${key}.`));
  }
  return fields;
}

/** Fresh, JSON-serializable snapshot. Consumers cannot mutate the next result. */
export function getContract(): CoreContract {
  const kinds = {} as Record<StuffKind, KindContract>;
  for (const schema of definitionSchema.options) {
    const kind = schema.shape.kind.value;
    const jsonSchema = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as CoreSchema;
    kinds[kind] = {
      schema: jsonSchema,
      fields: fieldMeanings(jsonSchema),
    };
  }
  return { contractVersion: 3, definitionSchemaVersion: 1, kinds, rules: [...rules] };
}
