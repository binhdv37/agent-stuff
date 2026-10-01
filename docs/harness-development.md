# Phát triển mapping harness

Tài liệu này là quy trình làm việc cho các session mới, cùng với `AGENTS.md`.
Harness ở đây là Codex, Claude Code, OpenCode; scope global/project là phạm vi
cài đặt, không quyết định ngữ nghĩa của asset.
Concept nội bộ xem [glossary](concepts.md); flow diễn giải request, kiểm tra
contract và author stuff xem [core development](core-development.md). Tài liệu
này quy định phần mapping và kiểm chứng harness của flow đó.

## Nguồn kiến thức và trách nhiệm

| Câu hỏi | Nguồn cần đọc hoặc sửa |
|---|---|
| Asset muốn làm gì, được kích hoạt và cấp quyền thế nào? | `core/` và `tool/src/core/schema.ts` |
| Harness biểu diễn ý định đó thế nào? | `adapters/<harness>/index.ts` và `tool/src/render.ts` |
| Mapping đã được xác minh đến đâu? | `docs/compatibility.md`, gồm nguồn chính thức và giới hạn runtime |
| Luật nền tảng và khác biệt phiên bản của từng harness? | `docs/harnesses/README.md` và ghi chú harness liên quan; mở lại nguồn khi đổi mapping |
| Mapping được giữ đúng qua các lần sửa thế nào? | `tests/core-adapter.test.ts`, `tests/agent-policy.test.ts` |
| File được cài, cập nhật, khôi phục thế nào? | `tool/src/installation/`, `tests/lifecycle.test.ts` |
| Cách chạy và định dạng hiện hành? | `docs/adapter-development.md` |
| Vì sao có quyết định migration cũ? | `docs/migration.md`; plan lịch sử không thay thế contract hiện hành |

Không yêu cầu model nhớ luật harness từ session trước. Luật đã biết phải được
ghi thành mapping, bằng chứng và test trong repo. Khi thay đổi luật native,
đọc nguồn chính thức hiện tại; nếu nguồn mâu thuẫn với repo, xác minh và cập nhật
cả mapping lẫn bằng chứng, không âm thầm chọn một bên.

`docs/compatibility.md` là nơi duy nhất ghi trạng thái hỗ trợ và bằng chứng
harness. Không tạo thêm bảng trạng thái cạnh tranh trong tài liệu mới. Một kết
quả test file sinh ra không chứng minh model thực thi đúng hoặc harness nhận file.

## Flow cho mapping

Áp dụng khi thêm/sửa native mapping hoặc điều tra regression. Flow author stuff
và các lệnh kiểm chứng chung ở [core development](core-development.md).

1. Đọc contract core, adapter/test hiện có, baseline harness và compatibility.
   Xác định target client, phiên bản và native format cần kiểm tra.
2. Mở tài liệu chính thức liên quan, đối chiếu baseline. Đánh giá cơ chế native
   có giữ contract không; báo supported/limited/unsupported và phương án thay
   thế. Thiếu bằng chứng phải ghi chưa xác minh. Policy không enforce được phải
   bị chặn; prompt guard cho activation chỉ được báo limited.
3. Sửa compatibility check, render và test mapping. Kiểm tra cả hành vi được
   phép/bị cấm và trường hợp limited/unsupported. Adapter chỉ trả dữ liệu trong
   bộ nhớ; thay đổi filesystem vẫn thuộc installer.
4. Kiểm tra runtime discovery khi đổi native config/discovery, và hành vi thực
   tế nếu tuyên bố enforce. Dùng context tạm; ghi kết quả và giới hạn vào
   compatibility, cập nhật baseline theo [quy tắc hồ sơ](harnesses/README.md).
   Giữ bằng chứng cũ; nếu chưa chạy runtime thì báo rõ.
   Khi mapping đổi, sinh lại [bảng kiểm chứng stuff](verification/README.md)
   để hiện hồ sơ Stale, rồi test lại các target trước khi tuyên bố được kiểm chứng
   theo [testing guide](testing.md).

## Ví dụ: skill chỉ được gọi thủ công

Điểm xuất phát là `activation: explicit` trong core. Session mới lần theo:

- `tool/src/core/schema.ts`: ý định portable và các giá trị hợp lệ.
- Adapter của từng harness: cách dịch ý định đó ra cấu hình native hoặc báo limited.
- `tests/core-adapter.test.ts`: kiểm tra mapping và compatibility.
- `docs/compatibility.md`: nguồn định dạng và mức kiểm chứng thực tế.

Không tạo override cho từng skill chỉ để đổi tên tham số activation. Đây là quy
tắc chung của harness, nên mọi skill đi qua cùng một mapping trong adapter.
Không sao chép field của Claude Code sang Codex hoặc OpenCode vì tên có vẻ phù hợp.

## Khi nào cần cấu hình riêng theo asset?

**Hiện tại chưa có loader/schema/CLI cho per-asset override hoặc profile.** Các
quy tắc dưới đây là tiêu chí thiết kế khi triển khai mở rộng, không phải cú pháp
đang dùng được. Không thêm YAML mà CLI chưa đọc rồi coi tính năng đã hoạt động.

- Nếu cấu hình biểu đạt ý định có nghĩa trên nhiều harness, ưu tiên field portable
  có schema và mapping rõ trên từng adapter.
- Nếu cấu hình là quy tắc chung để dịch ý định portable, giữ trong adapter code.
- Nếu chỉ một asset cần một tùy chọn native, đánh giá cơ chế override riêng.
  Workflow chính vẫn ở core; chưa chốt đường dẫn hoặc format override.
- Preference cá nhân/project là nhu cầu riêng. Chỉ thêm profile khi có use case;
  không trộn preference cài đặt với bản định nghĩa asset được phân phối.

Trước khi triển khai override, ghi quyết định thiết kế dưới `docs/decisions/`, nêu
use case cụ thể và lý do field portable hoặc mapping hiện có chưa đáp ứng. Quyết
định cần xác định: schema theo harness/kind và lỗi field lạ; thứ tự áp dụng và cách
thay thế danh sách; field core nào không được override; cách ghép instructions nếu
cần; kiểm tra tham chiếu/path; báo compatibility; preview; manifest/update; đóng
gói cả source lẫn compiled CLI. Tránh deep merge tùy ý.

Activation, identity, workflow reference, role và policy portable không được âm
thầm bị thay bằng cấu hình native. Muốn thay ý định, sửa định nghĩa core; cấu hình
native phải giữ các ràng buộc đó. Override không làm asset unsupported tự trở thành
supported. Unknown harness/kind/asset hoặc field không hợp lệ phải gây lỗi.

Loader đọc/validate cấu hình; adapter nhận dữ liệu trong bộ nhớ và render; installer
vẫn là nơi duy nhất ghi file. Test phải chứng minh cấu hình chỉ tác động đúng
harness/asset, lỗi bị bắt trước khi ghi và update dùng đúng source đã ghi nhận.

## Mẫu mô tả công việc cho session mới

```text
Mục tiêu và ví dụ trước/sau:
Asset/harness/scope bị ảnh hưởng:
Ý định portable và phần native riêng:
Mapping/test/tài liệu hiện có đã đọc:
Baseline adapter cũ và target client/format:
Nguồn chính thức URL/mục, ngày đọc và phiên bản (nếu đổi mapping):
Supported/limited/unsupported dự kiến và lý do:
File nguồn cần sửa:
Kiểm chứng cần chạy và runtime chưa xác minh:
Tài liệu cần cập nhật:
```

Mẫu giúp tránh bỏ sót, không thay thế schema, test hoặc bằng chứng runtime.
