# Tương thích adapter

Kiểm tra ngày 2026-09-28. Các định dạng và giới hạn dưới đây thuộc adapter hiện tại.

| Harness | Thành phần | Trạng thái |
|---|---|---|
| OpenCode 1.18.32 | 11 skill và resource, global/project | Render/install được kiểm tra; discovery project thực tế |
| OpenCode 1.18.32 | Explicit invocation | Limited: instruction trong description, chưa có native enforcement |
| OpenCode 1.18.32 | 2 command dùng skill không có resource | Config discovery và placeholder đã kiểm tra |
| OpenCode 1.18.32 | Agent có policy cơ bản | Đã kiểm tra config role và tập tool bị vô hiệu hóa trên runtime |
| OpenCode 1.18.32 | Hai agent đi kèm repo | Unsupported do các tổ hợp policy bên dưới |
| Codex | 11 skill, metadata UI và invocation policy | Render/install và global/project bằng filesystem test; chưa runtime smoke |
| Claude Code | 11 skill, slash entry và invocation policy | Render/install và global/project bằng filesystem test; chưa runtime smoke |
| Codex/Claude Code | Agent primary và command riêng | Không ánh xạ; CLI báo unsupported |

Global được kiểm tra bằng filesystem context tạm; chưa kiểm tra discovery global
bằng harness thật. Smoke OpenCode dùng XDG config/data/cache/state riêng và pure
mode trong project tạm. Chưa gọi model để thực thi workflow. Kết quả không suy
rộng sang mọi phiên bản hoặc cấu hình permission do người dùng ghi đè.

## Agent policy

OpenCode adapter sinh `permission` với catch-all deny, rồi mở các quyền đã khai
báo. Policy cơ bản đã được kiểm tra bằng `debug agent`: role primary được nhận;
edit/write/bash/task bị tắt trong mẫu chỉ đọc, read/glob/grep và question được mở.

- `solution-architect`: core cấm ghi nhưng cho shell ask. Shell vẫn có thể ghi
  sau khi được duyệt; adapter chặn tổ hợp này. Không tự đổi lựa chọn của tác giả.
- `experimental-plan`: cần giới hạn ghi theo thư mục và ủy nhiệm. Adapter chưa
  bảo đảm quyền xuyên qua các agent được gọi nên chặn. Ý định delegation vẫn giữ.

Đây là thiếu hụt chức năng đã biết so với việc copy nguyên agent bằng installer
cũ. Cần mở rộng adapter hoặc quyết định sửa policy trước khi cài hai agent này.

## Nguồn định dạng

- [OpenCode skills](https://opencode.ai/docs/skills/): đường dẫn discovery và
  frontmatter; field không nhận biết bị bỏ qua. Explicit invocation của adapter
  được báo limited, không tuyên bố enforce bằng field bị bỏ qua.
- [OpenCode commands](https://opencode.ai/docs/commands/): Markdown command,
  tên file và `$ARGUMENTS`.
- [OpenCode agents](https://opencode.ai/docs/agents/) và
  [permissions](https://opencode.ai/docs/permissions/): singular `permission`,
  primary/subagent, task permission và luật khớp cuối có hiệu lực.
- [Codex local skills](https://learn.chatgpt.com/docs/build-skills): `.agents/skills`
  tại project/home, UI metadata trong `agents/openai.yaml` và
  `policy.allow_implicit_invocation` cho explicit invocation.
- [Claude Code skills](https://code.claude.com/docs/en/skills): `.claude/skills`,
  `disable-model-invocation`, `argument-hint` và slash command từ skill.

Adapter không sửa config chung của người dùng. `--compatible-only` chủ động bỏ
các asset chưa hỗ trợ và in lý do; nếu chọn cụ thể asset đó, lệnh sẽ thất bại
trước khi ghi. Preview hiển thị limited; apply cần chấp nhận giới hạn.
