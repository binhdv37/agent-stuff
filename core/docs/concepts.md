# Các concept nội bộ của Agent-stuff

Core định nghĩa các concept và ngữ nghĩa portable dưới đây. Tên tương tự trong
một harness không bảo đảm cùng nghĩa. Core không phụ thuộc adapter hoặc installer.

## Thuật ngữ

| Thuật ngữ | Nghĩa |
|---|---|
| Stuff | Thành phần tái sử dụng có nội dung, cấu hình và contract riêng |
| Core value | Workflow, prompt/template hoặc instructions định hình agent |
| Cấu hình core | Tham số portable điều khiển cách dùng hoặc ràng buộc stuff |
| Contract | Ý nghĩa, input, output, ràng buộc và tiêu chí kiểm chứng |
| Asset | Một instance của stuff trong catalog; tên dùng trong implementation |
| Harness | Môi trường AI Agent chạy nội dung, như Codex, OpenCode, Claude Code |
| Adapter | Diễn giải contract core thành cơ chế native của harness |
| Installer | Quản lý preview và vòng đời file cài ở global/project scope |

## Các loại stuff

### i-skill

Năng lực/workflow tái sử dụng gồm instructions và tài nguyên cần thiết. Core value
mô tả cách thực hiện; config mô tả activation và metadata. `explicit` yêu cầu user
gọi rõ ràng; `matching-request` cho phép model tự chọn khi request phù hợp.

### i-command

Prompt/template được user chủ động gọi, có thể nhận input. Schema v1 hiện chỉ hỗ
trợ tham chiếu một i-skill qua `workflow: skill/<id>` để duy trì workflow một lần.
Concept rộng hơn không có nghĩa loader đã hỗ trợ template độc lập.

### i-agent

Vai trò, bản sắc, cách suy nghĩ và cách làm việc của agent, được định hình bằng
instructions. Config biểu đạt role và policy thực thi. Persona “chỉ đọc” không
thay quyền cấm ghi; primary không được tự đổi thành delegated để dễ mapping.

## Nội dung và cấu hình

Core sở hữu kiểu, giá trị hợp lệ, mặc định, phạm vi, xung đột và kết quả của config.
Phân loại yêu cầu trước khi thêm field:

- Cách làm riêng của workflow: core value.
- Ý định dùng chung giữa harness: config portable, nếu có contract rõ.
- Cú pháp/cơ chế native: adapter.
- Preference cá nhân/project khi cài: bên triển khai, không trộn vào asset portable.

Schema hiện chưa hỗ trợ model preference, profile hoặc native per-asset overrides.
Không thêm YAML mà loader chưa hiểu; chỉ mở rộng contract khi có use case thực tế.

## Contract khi được chuyển đổi

Không cần mapping 1–1 với concept native, nhưng phải giữ ý nghĩa core. `supported`
là bảo toàn; `limited` là khác biệt được công khai và chấp nhận; `unsupported` là
yêu cầu bắt buộc không giữ được. Không âm thầm bỏ config hoặc dùng lời nhắc thay
policy. Phương án đổi semantics cần user đồng ý. Mapping support và runtime
verification là hai thông tin khác nhau; core chỉ validate contract portable.

## Tên trong schema v1

| Concept | kind | Thư mục từ core root | Full key |
|---|---|---|---|
| i-skill | skill | skills/ | skill/&lt;id&gt; |
| i-command | command | commands/ | command/&lt;id&gt; |
| i-agent | agent | agents/ | agent/&lt;id&gt; |

`i-*` chỉ là tên concept, không phải kind YAML/flag CLI. Loại mới cần contract,
schema và loader; đổi format cần migration có chủ đích. Xem [format](format.md),
[fields](fields.md) và [API](README.md) để author hoặc consume core.
