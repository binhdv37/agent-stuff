# Ghi chú migration

## Nguồn nội dung

11 skill, 2 agent và 2 command đã chuyển vào `core/`. Metadata YAML tách khỏi
Markdown. Resource của skill giữ nguyên đường dẫn tương đối, kể cả bốn tài liệu
`*-FORMAT.md` ở gốc teach. Hash nội dung skill và resource trước migration nằm ở
`tests/fixtures/migration-inventory.json` và được kiểm tra bằng test.

Chính sách kích hoạt giữ nguyên: 9 explicit-only, grill-me và smart-commit là
matching-request. Metadata giao diện handoff/teach được đưa vào core. Adapter
Codex sinh `agents/openai.yaml`; adapter Claude Code sinh native frontmatter.

## Hợp nhất command

| Command | Nội dung chung | Phần riêng được giữ |
|---|---|---|
| change-report | Skill change-report | Wrapper truyền đối số thành phạm vi; skill giữ yêu cầu kiểm tra git diff và các mục báo cáo |
| explain-code | Skill explain-code | Wrapper truyền target; skill vẫn yêu cầu hỏi lại khi target thiếu và đọc code trước khi giải thích |

Cả hai command lấy hướng dẫn từ skill khi build. Các khác biệt diễn đạt giữa bản
command cũ và skill đã được thay bằng bản skill; không lưu hai bản workflow.
Codex dùng skill tương ứng; Claude Code đã cung cấp slash command từ skill nên
adapter không sinh thêm command trùng tên.

## Agent và thay đổi có chủ đích

- Sửa lỗi YAML của description planner chứa dấu `:` chưa được quote.
- Core giữ vai trò primary của cả hai agent.
- Planner dùng `.auragent/plans/` tương đối với project, thay cho đường dẫn gốc
  filesystem `/.auragent/plans/`. Nội dung hỏi người dùng dùng mô tả khả năng thay
  cho tên tool `question`.
- Core planner giữ ý định đọc workspace, ghi trong thư mục plan và ủy nhiệm;
  quyền shell mkdir tuyệt đối cũ không được mang sang core. Shell mặc định deny.
- Architect giữ shell ask và cấm ghi. Đây là tổ hợp chưa đáp ứng yêu cầu cấm ghi
  qua mọi công cụ; OpenCode adapter chặn thay vì âm thầm đổi quyền.
- Planner cũng bị chặn vì adapter chưa hỗ trợ scoped write cùng delegation.
  Hai định nghĩa được bảo toàn để tiếp tục hoàn thiện; không quảng bá là cài được.

## Cài đặt

`install.sh` hiện là launcher từ checkout, không tải nhánh main rồi thay cả thư
mục. Bỏ hướng dẫn `npx skills add` và cách `curl | bash`; clone checkout hoặc dùng
file tgz tạo bằng `npm pack`. Có thể chọn tag/commit bằng Git trước khi build.
CLI không tự tải release hoặc cập nhật chính nó.

Bản cài từ installer cũ chưa có manifest. File trùng đích sẽ gây conflict; cần
backup và di chuyển các file đó trước khi dùng installer mới. CLI không xóa cả
thư mục skill và không tự nhận quyền sở hữu file cũ.

Manifest mới ở `.agent-stuff/installations/<scope>/<harness>.json` dưới home hoặc
project tương ứng. Bản thử nghiệm trước migration từng dùng đường dẫn không có
`<scope>`; không tự động nhập state thử nghiệm đó. Các lần thử đã dùng thư mục tạm.
