import { z } from 'zod';

export const relativePath = z.string().min(1).refine(value =>
  !value.includes('\\') && !value.includes(':') && !value.includes('\0') &&
  !value.startsWith('/') && value.split('/').every(p => p !== '' && p !== '.' && p !== '..'),
  'Expected a normalized relative path inside the asset');
export type FieldCategory = 'structure' | 'metadata' | 'content' | 'behavior' | 'enforcement';
export type FieldMeaning = { category: FieldCategory; description: string };

// Attach semantics after optional/default/refinement wrappers so JSON export retains them.
const field = <T extends z.ZodType>(validator: T, category: FieldCategory, description: string): T =>
  validator.meta({ description, 'x-core-category': category });

const id = z.string().max(64).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const common = {
  schema_version: field(z.literal(1), 'structure', 'Phiên bản format definition.yaml; hiện chỉ chấp nhận 1.'),
  id: field(id, 'structure', 'ID kebab-case, tối đa 64 ký tự; phải khớp tên thư mục. Full key là kind/id. Quy ước authoring dùng bdv- cho skill/command, schema không enforce prefix này.'),
  description: field(z.string().min(1).max(1024), 'content', 'Mô tả mục đích và ngữ cảnh sử dụng; có thể tham gia discovery nên không được coi như metadata hiển thị có thể bỏ qua.'),
  display_name: field(z.string().min(1).optional(), 'metadata', 'Tên hiển thị tùy chọn; không thay ID hoặc quyền kích hoạt.'),
  short_description: field(z.string().min(1).optional(), 'metadata', 'Mô tả ngắn để hiển thị; không thay description hoặc contract hành vi.'),
};
const content = {
  instructions: field(relativePath, 'content', 'Đường dẫn tương đối đến hướng dẫn UTF-8 không rỗng; instructions.md là quy ước, tên file khác hợp lệ. Hướng dẫn không thay thế enforcement policy.'),
  resources: field(z.array(relativePath).default([]).refine(a => new Set(a).size === a.length, 'Duplicate resources'), 'content', 'Danh sách file hỗ trợ tương đối trong asset; giữ nguyên byte, không trùng. Không dùng definition.yaml, SKILL.md hoặc file instructions làm resource.'),
};
const decision = z.enum(['allow', 'ask', 'deny']);
export const definitionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...common, ...content,
    kind: field(z.literal('skill'), 'structure', 'Loại stuff: skill, agent hoặc command; phải khớp thư mục chứa.'),
    activation: field(z.enum(['explicit', 'matching-request']).default('explicit'), 'behavior', 'explicit: chỉ kích hoạt khi user yêu cầu workflow hoặc gọi tên skill rõ ràng. matching-request: model được tự chọn khi request phù hợp, không bắt buộc tự kích hoạt. Giới hạn native phải được báo, không âm thầm bỏ field.'),
    argument_hint: field(z.string().optional(), 'metadata', 'Gợi ý input/đối số cho người dùng; không phải parser, giá trị mặc định hay cú pháp placeholder native.'),
  }),
  z.strictObject({ ...common, ...content,
    kind: field(z.literal('agent'), 'structure', 'Loại stuff: skill, agent hoặc command; phải khớp thư mục chứa.'),
    role: field(z.enum(['primary', 'delegated']), 'behavior', 'primary: agent người dùng làm việc trực tiếp; delegated: helper được agent khác gọi. Không đổi role để thuận tiện mapping.'),
    policy: field(z.strictObject({
      workspace_read: field(decision.default('deny'), 'enforcement', 'Quyền đọc/tìm kiếm nội dung workspace.'),
      workspace_write: field(decision.default('deny'), 'enforcement', 'Quyền ghi/sửa workspace mặc định; write_paths khai báo các ngoại lệ allow.'),
      shell: field(decision.default('deny'), 'enforcement', 'Quyền chạy shell; không được dùng shell để vượt giới hạn ghi.'),
      questions: field(decision.default('deny'), 'enforcement', 'Quyền dùng cơ chế hỏi người dùng của harness.'),
      delegation: field(decision.default('deny'), 'enforcement', 'Quyền gọi helper; allow chỉ hợp lệ khi có delegation_targets tường minh.'),
      delegation_targets: field(z.array(z.string().regex(/^agent\/[a-z0-9]+(-[a-z0-9]+)*$/)).default([]), 'enforcement', 'Full key agent/id được phép gọi. Mỗi target phải tồn tại, có role delegated, deny ghi/shell/delegation và không có write_paths.'),
      write_paths: field(z.array(relativePath).default([]), 'enforcement', 'Pattern đường dẫn tương đối theo project, làm ngoại lệ allow cho workspace_write. Không đi ra ngoài project; không được kết hợp danh sách khác rỗng với workspace_write: allow. Adapter phải bảo toàn phạm vi pattern hoặc báo unsupported.'),
    }), 'enforcement', 'Quyền thực thi, tách biệt với persona/instructions. allow: được phép; ask: cần xin phép trước hành động; deny: bị cấm. Mỗi quyền bỏ trống mặc định deny; policy object vẫn bắt buộc.'),
  }),
  z.strictObject({ ...common,
    kind: field(z.literal('command'), 'structure', 'Loại stuff: skill, agent hoặc command; phải khớp thư mục chứa.'),
    workflow: field(z.string().regex(/^skill\/[a-z0-9]+(-[a-z0-9]+)*$/), 'behavior', 'Tham chiếu skill/id phải tồn tại trong catalog. Command là điểm gọi chủ động dùng lại workflow; schema v1 chưa có template độc lập.'),
    argument_hint: field(z.string().optional(), 'metadata', 'Gợi ý input/đối số; không định nghĩa parser hoặc placeholder native.'),
  }),
]);
export type Definition = z.infer<typeof definitionSchema>;
export type Asset = { key: string; definition: Definition; body: string; resources: Map<string, Buffer> };
