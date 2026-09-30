# Tương thích adapter

Cập nhật ngày 2026-09-30. Các định dạng và giới hạn dưới đây thuộc adapter hiện tại.

| Harness | Thành phần | Trạng thái |
|---|---|---|
| OpenCode 1.18.32 | 11 skill và resource, global/project | Render/install được kiểm tra; discovery project thực tế |
| OpenCode 1.18.32 | Explicit invocation | Limited: instruction trong description, chưa có native enforcement |
| OpenCode 1.18.32 | 2 command dùng skill không có resource | Config discovery và placeholder đã kiểm tra |
| OpenCode 1.18.32 | Agent có policy cơ bản | Đã kiểm tra config role và tập tool bị vô hiệu hóa trên runtime |
| OpenCode 1.18.33 | Hai primary agent và helper chỉ đọc | Đã kiểm tra runtime discovery, role và permission rules |
| Codex CLI | 11 skill, metadata UI và invocation policy | Render/install bằng filesystem test; app-server đã phát hiện handoff skill trong project tạm |
| Claude Code | 11 skill, slash entry và invocation policy | Render/install và global/project bằng filesystem test; người dùng xác nhận runtime chạy thành công ngày 2026-09-30 |
| Codex/Claude Code | Agent primary và command riêng | Không ánh xạ; CLI báo unsupported |

Global được kiểm tra bằng filesystem context tạm; các kiểm tra runtime OpenCode
và Codex ghi nhận ở trên dùng project tạm. Smoke OpenCode dùng XDG
config/data/cache/state riêng và pure mode; chưa gọi model để thực thi workflow.

Claude Code đã được người dùng thử thủ công và xác nhận hoạt động ngày
2026-09-30, nên mục runtime smoke được đánh dấu hoàn thành. Chưa ghi nhận phiên
bản CLI, scope, skill cụ thể hoặc các bước thử; kết quả này không xác nhận riêng
toàn bộ 11 skill, cả hai scope hay hành vi invocation policy. Kết quả runtime
không suy rộng sang mọi phiên bản hoặc cấu hình permission do người dùng ghi đè.

## Agent policy

OpenCode adapter sinh `permission` với catch-all deny, rồi mở các quyền đã khai
báo. Policy cơ bản đã được kiểm tra bằng `debug agent`: role primary được nhận;
edit/write/bash/task bị tắt trong mẫu chỉ đọc, read/glob/grep và question được mở.

- `solution-architect`: core cấm ghi và cấm shell, vẫn đọc file và hỏi người dùng.
- `experimental-plan`: `edit` mặc định deny, chỉ mở `.auragent/plans/*` tương
  đối với workspace. `bash` và truy cập directory ngoài
  project đều deny. `task` mặc định deny; chỉ cho gọi `bdv-plan-reviewer`.
- `bdv-plan-reviewer`: subagent chỉ đọc; edit, bash và task đều deny. Chọn
  planner sẽ tự chọn helper để tránh cài thiếu dependency.

Việc cấm shell của architect thay đổi hành vi so với bản agent cũ (`bash: ask`).
Planner không còn gọi general agent có quyền sửa code; helper chỉ đọc thay nó
trong các bước khám phá và phản biện. Chưa chạy một phiên model đầy đủ để chứng
minh việc tạo plan trong thư mục mới; `debug agent` đã xác nhận rule được nạp.

## Nguồn định dạng

- [OpenCode skills](https://opencode.ai/docs/skills/): đường dẫn discovery và
  frontmatter; field không nhận biết bị bỏ qua. Explicit invocation của adapter
  được báo limited, không tuyên bố enforce bằng field bị bỏ qua.
- [OpenCode commands](https://opencode.ai/docs/commands/): Markdown command,
  tên file và `$ARGUMENTS`.
- [OpenCode agents](https://opencode.ai/docs/agents/) và
  [permissions](https://opencode.ai/docs/permissions/): singular `permission`,
  primary/subagent, task permission và luật khớp cuối có hiệu lực.
- [OpenCode write tool](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/write.ts):
  kiểm tra edit bằng đường dẫn tương đối với worktree và tạo thư mục cha khi ghi.
- [Codex local skills](https://learn.chatgpt.com/docs/build-skills): `.agents/skills`
  tại project/home, UI metadata trong `agents/openai.yaml` và
  `policy.allow_implicit_invocation` cho explicit invocation.
- [Claude Code skills](https://code.claude.com/docs/en/skills): `.claude/skills`,
  `disable-model-invocation`, `argument-hint` và slash command từ skill.

Adapter không sửa config chung của người dùng. `--compatible-only` chủ động bỏ
các asset chưa hỗ trợ và in lý do; nếu chọn cụ thể asset đó, lệnh sẽ thất bại
trước khi ghi. Preview hiển thị limited; apply cần chấp nhận giới hạn.
