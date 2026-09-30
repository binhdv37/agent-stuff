# Quy trình phát triển asset và harness

Tài liệu này là quy trình làm việc cho các session mới, cùng với `AGENTS.md`.
Harness ở đây là Codex, Claude Code, OpenCode; scope global/project là phạm vi
cài đặt, không quyết định ngữ nghĩa của asset.

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

## Flow cho một thay đổi

1. Đọc `AGENTS.md`, README, tài liệu này, ghi chú trong `docs/harnesses/` và phần
   compatibility liên quan. Kiểm tra `git status --short`; đọc asset, schema,
   adapter và test hiện có của hành vi đó.
2. Viết rõ kết quả mong muốn bằng ý định trung lập: loại asset, activation, role,
   policy, resource, scope. Với skill mới, hỏi về automatic invocation theo
   `AGENTS.md`; không hỏi lại preference đã được xác lập.
3. Phân loại thay đổi: nội dung chung thuộc core; quy tắc dịch chung thuộc adapter;
   thao tác filesystem thuộc installer. Nếu là yêu cầu native riêng của một asset,
   dùng tiêu chí mở rộng bên dưới trước khi chọn cách lưu cấu hình.
4. Với mapping native mới hoặc thay đổi, kiểm tra tài liệu chính thức của từng
   harness bị ảnh hưởng. Ghi nguồn, ngày kiểm tra, phiên bản nếu biết và điều chưa
   xác minh. Nếu không lấy được bằng chứng, ghi rõ phần chưa xác minh; không nâng
   trạng thái hỗ trợ dựa trên suy đoán. Đây không phải lý do chặn sửa nội dung thuần
   portable không đổi mapping.
5. Triển khai từ nguồn: schema/loader nếu cần, compatibility check, adapter render,
   rồi installer nếu vòng đời file thay đổi. Không sửa generated output. Tính năng
   không được hỗ trợ phải được báo rõ; policy không enforce được phải bị chặn.
   Hạn chế activation bằng prompt phải được báo limited, không coi là enforcement.
6. Với thay đổi implementation, thêm hoặc sửa test cho hành vi quan sát được:
   cùng ý định core được render đúng trên từng harness hỗ trợ, trường hợp unsupported
   bị từ chối và trường hợp limited được báo. Với thay đổi quyền, kiểm tra cả quyền
   được mở và quyền vẫn bị cấm. Chỉ thêm filesystem test khi vòng đời file thay đổi.
7. Chạy `npm test` cho implementation, `npm run typecheck` khi cần, và
   `npm run cli -- validate --source .` cho content. Runtime discovery là bước riêng
   khi đổi discovery/native config; dùng home/project tạm và ghi kết quả vào
   compatibility. Nếu chưa chạy runtime, giữ giới hạn đó trong tài liệu và báo cáo.
8. Cập nhật README khi inventory/hành vi public thay đổi, compatibility khi mapping
   hoặc bằng chứng thay đổi, development guide khi schema/CLI thay đổi. Báo cáo
   kết quả, kiểm chứng và giới hạn còn lại. Publish/tag/gửi tin là hành động riêng.

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
- Nếu chỉ một asset cần một tùy chọn native của một harness, có thể bổ sung cấu
  hình theo harness/asset dưới `adapters/<harness>/overrides/<kind>/<id>.yaml`.
  Workflow chính vẫn ở core; không tạo bản sao instructions đầy đủ.
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
Nguồn chính thức, ngày kiểm tra và phiên bản (nếu đổi mapping):
Supported/limited/unsupported dự kiến và lý do:
File nguồn cần sửa:
Kiểm chứng cần chạy và runtime chưa xác minh:
Tài liệu cần cập nhật:
```

Mẫu giúp tránh bỏ sót, không thay thế schema, test hoặc bằng chứng runtime.
