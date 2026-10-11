# Adapter module

Adapter phụ thuộc public API core, không import tool. Nó check contract rồi trả
native files trong bộ nhớ; installer sở hữu filesystem, confirmation và recovery.
Entrypoint: `adapters/index.ts`; compile: `dist/adapters/index.js` và declarations.

## API

```js
import { getAdapter } from './dist/adapters/index.js';
import { loadCatalog } from './dist/core/src/index.js';

const catalog = await loadCatalog('/path/to/core');
const asset = catalog.get('skill/bdv-handoff');
const adapter = getAdapter('codex');
const report = adapter.check(asset, catalog);
if (report.status !== 'unsupported') {
  const files = adapter.render(asset, catalog);
  // Obtain acceptance for limited before passing files to an installer.
}
```

Adapter có id, revision, directories, supportedContractVersions, check và render.
Report có asset, status, reason và issues (`field`, `status`, `reason`, `effect`);
field có thể thuộc dependency, như workflow.resources.

- `supported`: bảo toàn yêu cầu đã khai báo.
- `limited`: khác biệt được công khai; consumer phải xin chấp nhận trước apply.
- `unsupported`: mất yêu cầu bắt buộc; render bị chặn.

`defineAdapter` guard cả check/render, kể cả gọi render trực tiếp. Revision 2 hiểu
core contract 3, definition schema 1 và vocabulary kind/field đã pin. Mismatch báo
AdapterContractError với expected/actual. Unknown field bị chặn; field có mặt nhưng
chưa mapping: metadata có thể limited, content/behavior/enforcement unsupported.
Optional không có nghĩa được phép bỏ giá trị đã khai báo.

AdapterImplementation khai báo mappedFields theo kind; native check xử lý thêm tổ
hợp field. readContract tùy chọn cho consumer/tests cung cấp contract. Guard không
so toàn bộ type/default/semantics; core author phải tăng contract version khi đổi
chúng. Factory không render khi check thất bại, không ghi file hoặc gọi network.

## Phát triển mapping

1. Đọc [core contract](../core/docs/README.md), adapter/test, [compatibility](docs/compatibility.md)
   và note của harness: [Codex](docs/harnesses/codex.md),
   [Claude Code](docs/harnesses/claude-code.md), [OpenCode](docs/harnesses/opencode.md).
   Chốt target client/version, format và scope; scope không định nghĩa semantics.
2. Khi thêm/sửa native behavior hoặc có regression, mở nguồn chính thức hiện tại.
   Đánh giá supported/limited/unsupported, cơ chế enforce và phương án thay thế.
   Không suy luật harness này từ harness khác. Thiếu bằng chứng thì ghi chưa xác minh.
3. Implement check/render và test trong adapter; thử cả allowed/denied,
   limited/unsupported và dependency. Core validation thuộc core; lifecycle thuộc tool.
4. Test discovery khi đổi native discovery/config; test behavior thật nếu tuyên bố
   enforce. Theo [testing](../docs/testing.md), dùng context tạm và lưu evidence.
5. Cập nhật note/baseline, compatibility và generate verification summary để hiện
   stale; test lại các target đã cam kết trước khi tuyên bố verified.

Policy không enforce được phải chặn, không thay bằng prompt. “Chưa mapping” khác
“harness không có capability”; native capability không tự thành adapter support.

## Baseline và tài liệu

Mỗi adapter giữ note trong `docs/harnesses/<harness>.md`: revision/code, client,
format/scope, version đã biết (thiếu thì ghi chưa ghi nhận), nguồn cụ thể URL/mục,
ngày đọc thật, quy tắc/giả định, test và link evidence. URL thay đổi cần tóm tắt
quy tắc; nguồn code nên pin commit khi research lại. Version đã thử không là range
bảo đảm; CLI hiện chưa gate harness version.

Khi đổi mapping, ghi baseline mới và thay đổi so với mốc cũ; giữ mốc cũ ngắn hoặc
link Git cố định. Không sửa ngày đọc cũ thành lượt mới. Compatibility là nguồn
trạng thái adapter hiện hành; notes giữ quy tắc native, verification giữ kết quả.
Không sao chép toàn bộ docs bên ngoài hoặc tạo bảng hỗ trợ cạnh tranh.

## Mở rộng config

Hiện chưa hỗ trợ per-asset native override/profile. Ý định portable thuộc core;
quy tắc dịch chung thuộc adapter. Chỉ thiết kế override khi có asset/use case cụ
thể mà cả hai không đáp ứng; không thêm YAML chưa có loader.

Thiết kế phải chốt schema/unknown-field errors, precedence/list replacement,
identity/workflow/role/policy không được đổi âm thầm, resource/path checks,
compatibility/preview, manifest/update và package. Không deep merge tùy ý;
override không biến yêu cầu unsupported thành supported. Loader validate,
adapter nhận dữ liệu trong bộ nhớ, installer vẫn ghi file. Test isolation đúng
harness/asset và lỗi trước apply. Preference cài đặt không trộn vào asset.
