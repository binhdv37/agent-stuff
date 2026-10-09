# Các concept nội bộ của Agent-stuff

Agent-stuff là nơi phát triển và phân phối các thành phần để làm việc với AI
Agent harness. Các thuật ngữ dưới đây do project định nghĩa; tên tương tự trong
một harness không bảo đảm cùng ngữ nghĩa.

## Glossary

| Thuật ngữ | Định nghĩa |
|---|---|
| Stuff | Thành phần được author và phân phối bởi Agent-stuff, có nội dung, cấu hình và contract riêng |
| Core value | Nội dung chính của stuff: workflow, prompt/template, hoặc instructions định hình agent |
| Cấu hình core | Tham số có ngữ nghĩa do core định nghĩa, điều khiển cách dùng hoặc ràng buộc stuff |
| Contract | Ý nghĩa, đầu vào, kết quả, ràng buộc và tiêu chí kiểm chứng của loại stuff hoặc cấu hình |
| Harness | Môi trường AI Agent đích, ví dụ local Codex, OpenCode hoặc Claude Code |
| Adapter | Thành phần diễn giải contract core thành cơ chế mà một harness cụ thể hiểu được |
| Installer | Thành phần quản lý preview và vòng đời file đã cài trong global/project scope |
| Asset | Một instance của stuff trong catalog; đây cũng là thuật ngữ implementation hiện tại |

## Các loại stuff

### i-skill

Một năng lực hoặc workflow có thể tái sử dụng, gồm hướng dẫn thực hiện và tài
nguyên cần thiết. Core value mô tả cách thực hiện; cấu hình mô tả cách kích hoạt
và metadata liên quan. Nó gần với concept agent skill thông thường, nhưng contract
của project là nguồn quyết định ý nghĩa.

### i-command

Một prompt/template được user chủ động gọi, có thể nhận input để yêu cầu một hành
vi định nghĩa sẵn. Core value có thể được dùng lại từ workflow đã có để tránh
author hai bản nội dung giống nhau.

Implementation schema v1 hiện chỉ cho command tham chiếu một i-skill qua
`workflow: skill/<id>`. Template độc lập là khả năng mở rộng cần thiết kế và
triển khai; định nghĩa concept này không làm loader tự hỗ trợ nó.

### i-agent

Định nghĩa vai trò, bản sắc, cách suy nghĩ, cách tự hiểu về mình và cách làm việc
của một AI Agent. Core value là instructions định hình agent; cấu hình có thể
biểu đạt role và policy hoạt động.

Persona/instructions và quyền thực thi là hai phần riêng. Một câu yêu cầu chỉ
đọc không thay thế permission cấm ghi. Adapter phải giữ role và policy, không
tự biến primary agent thành delegated agent để tìm mapping thuận tiện hơn.

## Core value và cấu hình

Core sở hữu cả nội dung lẫn ngữ nghĩa cấu hình: kiểu dữ liệu, giá trị hợp lệ,
mặc định, phạm vi tác động, tổ hợp xung đột và kết quả mong muốn. Ví dụ activation
phân biệt user chủ động gọi với model tự chọn workflow. Một config mới phải nói
rõ đâu là hướng dẫn hành vi và đâu là ràng buộc cần cơ chế enforce.

Phân loại một yêu cầu trước khi thêm field:

- Hướng dẫn thực hiện riêng của workflow thuộc core value.
- Ý định dùng chung giữa các harness thuộc cấu hình core nếu có contract rõ.
- Cách biểu diễn ý định bằng native fields thuộc adapter.
- Preference cá nhân hoặc của project khi cài đặt cần thiết kế profile riêng.

Ví dụ yêu cầu model hỗ trợ hình ảnh có thể là ý định portable; một model ID của
provider cụ thể có thể là preference triển khai. Hiện schema chưa có hai config
này và installer chưa hỗ trợ profile. Không thêm YAML chưa được loader đọc.

## Mapping và khả năng mở rộng

Không yêu cầu ánh xạ 1–1 giữa loại stuff và concept native. Adapter có thể sinh
một hoặc nhiều file/cơ chế nếu giữ được contract. Mapping phải báo `supported`,
`limited` hoặc `unsupported` theo contract của API adapter. Adapter sở hữu báo
cáo mức hỗ trợ; kết quả kiểm chứng runtime là bằng chứng riêng.

Không âm thầm bỏ config, đổi role hay thay ràng buộc bắt buộc bằng lời nhắc.
Policy không enforce được phải bị chặn. Phương án thay thế cần nêu rõ thay đổi
ngữ nghĩa và được user lựa chọn khi nó thay đổi yêu cầu đã chốt.

Project có thể định nghĩa thêm loại stuff. Mỗi loại mới cần contract, schema,
loader/catalog, mapping hoặc lý do unsupported, test và tài liệu; không cần tạo
framework tổng quát trước khi có use case.

## Tên concept và format hiện tại

| Concept | `kind` schema v1 | Thư mục | Full key |
|---|---|---|---|
| i-skill | `skill` | `skills/` | `skill/<id>` |
| i-command | `command` | `commands/` | `command/<id>` |
| i-agent | `agent` | `agents/` | `agent/<id>` |

`i-*` là tên concept trong tài liệu, không phải giá trị YAML hoặc flag CLI mới.
Schema nghiêm ngặt hiện tại vẫn là contract format. Đổi tên format cần migration
riêng; không sửa generated output hoặc migration hashes chỉ để đồng bộ thuật ngữ.

Các thư mục trong bảng tính từ core root. Xem [format](format.md) cho cấu trúc
file, [fields](fields.md) cho từng field và [API](README.md) cho cách consume.
