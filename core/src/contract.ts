import { z } from 'zod';
import { definitionSchema } from '../../tool/src/core/schema.js';

export type StuffKind = 'skill' | 'agent' | 'command';
export type FieldCategory = 'structure' | 'metadata' | 'content' | 'behavior' | 'enforcement';
export type FieldMeaning = { category: FieldCategory; description: string };
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

const field = (category: FieldCategory, description: string): FieldMeaning => ({ category, description });
const common = {
  schema_version: field('structure', 'Phiên bản format definition.yaml; hiện chỉ chấp nhận 1.'),
  kind: field('structure', 'Loại stuff: skill, agent hoặc command; phải khớp thư mục chứa.'),
  id: field('structure', 'ID kebab-case, tối đa 64 ký tự; phải khớp tên thư mục. Full key là kind/id. Quy ước authoring dùng bdv- cho skill/command, schema không enforce prefix này.'),
  description: field('content', 'Mô tả mục đích và ngữ cảnh sử dụng; có thể tham gia discovery nên không được coi như metadata hiển thị có thể bỏ qua.'),
  display_name: field('metadata', 'Tên hiển thị tùy chọn; không thay ID hoặc quyền kích hoạt.'),
  short_description: field('metadata', 'Mô tả ngắn để hiển thị; không thay description hoặc contract hành vi.'),
};
const content = {
  instructions: field('content', 'Đường dẫn tương đối đến hướng dẫn UTF-8 không rỗng; instructions.md là quy ước, tên file khác hợp lệ. Hướng dẫn không thay thế enforcement policy.'),
  resources: field('content', 'Danh sách file hỗ trợ tương đối trong asset; giữ nguyên byte, không trùng. Không dùng definition.yaml, SKILL.md hoặc file instructions làm resource.'),
};
const meanings: Record<StuffKind, Record<string, FieldMeaning>> = {
  skill: {
    ...common, ...content,
    activation: field('behavior', 'explicit: chỉ kích hoạt khi user yêu cầu workflow hoặc gọi tên skill rõ ràng. matching-request: model được tự chọn khi request phù hợp, không bắt buộc tự kích hoạt. Giới hạn native phải được báo, không âm thầm bỏ field.'),
    argument_hint: field('metadata', 'Gợi ý input/đối số cho người dùng; không phải parser, giá trị mặc định hay cú pháp placeholder native.'),
  },
  agent: {
    ...common, ...content,
    role: field('behavior', 'primary: agent người dùng làm việc trực tiếp; delegated: helper được agent khác gọi. Không đổi role để thuận tiện mapping.'),
    policy: field('enforcement', 'Quyền thực thi, tách biệt với persona/instructions. allow: được phép; ask: cần xin phép trước hành động; deny: bị cấm. Mỗi quyền bỏ trống mặc định deny; policy object vẫn bắt buộc.'),
    'policy.workspace_read': field('enforcement', 'Quyền đọc/tìm kiếm nội dung workspace.'),
    'policy.workspace_write': field('enforcement', 'Quyền ghi/sửa workspace mặc định; write_paths khai báo các ngoại lệ allow.'),
    'policy.shell': field('enforcement', 'Quyền chạy shell; không được dùng shell để vượt giới hạn ghi.'),
    'policy.questions': field('enforcement', 'Quyền dùng cơ chế hỏi người dùng của harness.'),
    'policy.delegation': field('enforcement', 'Quyền gọi helper; allow chỉ hợp lệ khi có delegation_targets tường minh.'),
    'policy.delegation_targets': field('enforcement', 'Full key agent/id được phép gọi. Mỗi target phải tồn tại, có role delegated, deny ghi/shell/delegation và không có write_paths.'),
    'policy.write_paths': field('enforcement', 'Pattern đường dẫn tương đối theo project, làm ngoại lệ allow cho workspace_write. Không đi ra ngoài project; không được kết hợp danh sách khác rỗng với workspace_write: allow. Adapter phải bảo toàn phạm vi pattern hoặc báo unsupported.'),
  },
  command: {
    ...common,
    workflow: field('behavior', 'Tham chiếu skill/id phải tồn tại trong catalog. Command là điểm gọi chủ động dùng lại workflow; schema v1 chưa có template độc lập.'),
    argument_hint: field('metadata', 'Gợi ý input/đối số; không định nghĩa parser hoặc placeholder native.'),
  },
};

const rules = [
  'Schema là JSON Schema draft 2020-12 cho input YAML: required/default/type/enum được lấy từ validator hiện có. Unknown field bị từ chối ở cả definition và policy.',
  'JSON Schema không diễn đạt hết custom refinements, filesystem và quan hệ catalog. loadCatalog là bước validate đầy đủ; không dùng schema JSON để thay loader.',
  'Đường dẫn tương đối được chuẩn hóa: không rỗng, không tuyệt đối, không backslash/colon/NUL, không segment rỗng/dot/dot-dot. Resource và instructions phải tồn tại và không qua symlink.',
  'resources không trùng; instructions không rỗng; kind/id khớp thư mục; catalog không rỗng; workflow và delegation_targets phải tham chiếu đúng loại.',
  'write_paths khác rỗng không đi cùng workspace_write: allow. delegation_targets chỉ có khi delegation: allow, và allow cần ít nhất một target chỉ đọc, không shell, không delegation.',
  'Policy cần enforcement. Nếu shell làm mất giới hạn ghi, adapter phải chặn tổ hợp đó; đây là kiểm tra tương thích harness, không thêm ràng buộc YAML mới ở bước 1.',
  'metadata chỉ tác động hiển thị; content cần giữ nội dung và tài nguyên; behavior điều khiển cách dùng; enforcement cần cơ chế quyền. structure xác định format/identity. Category không tự quyết định một field được bỏ qua hay không.',
  'Không hiểu field ảnh hưởng hành vi thì chặn. Metadata hiển thị thiếu mapping có thể limited với báo cáo rõ. Nội dung hoặc quyền bắt buộc không bảo toàn được thì unsupported; không thay bằng lời nhắc.',
  'Contract version độc lập với schema_version YAML và revision adapter. Thay đổi API public, schema, default, ngữ nghĩa hoặc ràng buộc phải tăng contract version; chỉnh chính tả/diễn đạt không đổi nghĩa thì không. Adapter khai báo version hiểu được; enforcement version check triển khai ở bước 4.',
];

/** Fresh, JSON-serializable snapshot. Consumers cannot mutate the next result. */
export function getContract(): CoreContract {
  const kinds = {} as Record<StuffKind, KindContract>;
  for (const schema of definitionSchema.options) {
    const kind = schema.shape.kind.value;
    kinds[kind] = {
      schema: z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as CoreSchema,
      fields: structuredClone(meanings[kind]),
    };
  }
  return { contractVersion: 1, definitionSchemaVersion: 1, kinds, rules: [...rules] };
}
