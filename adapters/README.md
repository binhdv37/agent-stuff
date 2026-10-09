# Adapter module

Public entrypoint: `adapters/index.ts`; bản compile: `dist/adapters/index.js` và
declarations đi kèm. Module phụ thuộc public API core và yaml, không import tool.
Core định nghĩa contract; adapter đánh giá rồi trả files trong bộ nhớ. Installer
sở hữu filesystem, confirmation, conflicts và recovery.

```js
import { getAdapter } from './dist/adapters/index.js';
import { loadCatalog } from './dist/core/src/index.js';

const catalog = await loadCatalog('/path/to/core');
const asset = catalog.get('skill/bdv-handoff');
const adapter = getAdapter('codex');
const report = adapter.check(asset, catalog);
console.log(report.status, report.issues);
if (report.status !== 'unsupported') {
  const files = adapter.render(asset, catalog);
  // Consumer must obtain acceptance for limited before installing these files.
}
```

Adapter có id, revision, directories, supportedContractVersions, check và render.
Report có asset, status, reason và issues; mỗi issue có field, status, reason,
effect. Field path có thể chỉ đến dependency, như workflow.resources.

- supported: bảo toàn yêu cầu đã khai báo.
- limited: có khác biệt được công khai; installer phải xin chấp nhận trước apply.
- unsupported: thiếu yêu cầu bắt buộc; render bị chặn.

`defineAdapter` bọc mọi check/render bằng guard chung. Các adapter revision 2 hiểu
contract 3, definition schema 1 và vocabulary field đã pin. Version hoặc bộ kind/
field khác expected báo AdapterContractError với expected/actual, kể cả khi caller
gọi render trực tiếp. Unknown field trong definition bị unsupported. Field hiện
diện nhưng chưa mapping: metadata có thể limited; content/behavior/enforcement
bị unsupported. Contract author vẫn phải tăng version khi đổi type/default/ngữ
nghĩa; vocabulary guard không phải so sánh toàn bộ ngữ nghĩa schema.

AdapterImplementation khai báo mappedFields theo kind; check native bổ sung các
giới hạn của tổ hợp field. readContract tùy chọn trong factory cho phép consumer
cung cấp contract của thư viện core và tests mô phỏng mismatch. Hàm native render
không được gọi nếu guard/check thất bại. Factory không tự ghi file hay gọi network.

`--yes` không chấp nhận giới hạn; CLI dùng `--accept-limitations` sau khi hiển thị
report. `--compatible-only` có thể bỏ asset unsupported như hiện có, nhưng không
vượt mismatch contract toàn module. Uninstall/recover không cần core source và
không render lại, nên không bị gate contract mới.

Giới hạn báo “adapter chưa mapping” khác với “harness không có capability”. Không
thay native format/permission chỉ để tránh limited. Nguồn native và bằng chứng
runtime ở [compatibility](../docs/compatibility.md); [harness development](../docs/harness-development.md)
quy định khi thay mapping. Supported không đồng nghĩa đã verified workflow.
