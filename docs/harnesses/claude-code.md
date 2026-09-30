# Claude Code: ghi chú nền tảng

Ngày đọc: **2026-09-30**. Phạm vi local Claude Code; docs có tính năng theo phiên
bản, không mặc định binary của người dùng có mọi tính năng mới. Kết quả adapter
và runtime xem [compatibility](../compatibility.md).

## Skill, command và activation

Project skill ở `.claude/skills/<id>/SKILL.md`, user ở `~/.claude/skills/`.
`disable-model-invocation: true` giữ explicit `/name`, ngăn Claude tự load.
`user-invocable: false` ẩn entry của user, vẫn cho Claude gọi: hai field khác nhau.
Command `.claude/commands/<id>.md` vẫn hoạt động; docs hợp nhất concept command
vào skill. Skill có resource, `argument-hint`, `$ARGUMENTS`, `context: fork` và
`agent`. `allowed-tools` cấp quyền không hỏi trong turn gọi skill, không phải
allowlist giới hạn tool. Field lạ bị bỏ qua.
Nguồn: [Skills](https://code.claude.com/docs/en/skills).

Hệ quả cho repo: activation được dịch trong adapter; không sinh command trùng
skill. Không dùng `allowed-tools` để chứng minh read-only. Resource và workflow
vẫn do core sở hữu; cú pháp placeholder/fork native thuộc adapter.

## Agent và delegation

Markdown agent ở `.claude/agents/` hoặc `~/.claude/agents/`, với `name`,
`description`, body instructions; có `tools`, `disallowedTools`, model,
`permissionMode`, skills preload. `claude --agent <name>` có thể chạy definition
đó làm main thread. `Agent(worker, researcher)` giới hạn delegation khi chạy
main thread; danh sách type này bị bỏ qua trong subagent. Permission mode còn
phụ thuộc mode parent. Plugin agents có giới hạn khác local agents.
Nguồn: [Subagents](https://code.claude.com/docs/en/sub-agents).

Suy luận thiết kế: primary/delegated mapping có khả năng nghiên cứu thêm;
unsupported hiện tại là quyết định của adapter, không chứng minh harness không
có agent. Cần xác minh policy và đường launch trước khi thay mapping; không coi
`permissionMode: plan` tương đương toàn bộ policy core.

## Quyền và settings

Permission rules là `permissions.deny`, `ask`, `allow`; thứ tự xét là deny → ask
→ allow. Allow cụ thể không mở lại broad deny. Project allow cần workspace trust;
deny và ask không cấp thêm quyền nên không bị gate tương tự.
Nguồn: [Permissions](https://code.claude.com/docs/en/permissions).

Ưu tiên settings: managed → CLI → `.claude/settings.local.json` →
`.claude/settings.json` → `~/.claude/settings.json`. Các list thông thường,
bao gồm permission lists, được ghép; một số field có quy tắc riêng. Không áp
dụng quy tắc thay nguyên list cho mọi native config.
Nguồn: [Settings](https://code.claude.com/docs/en/settings).

Hệ quả cho repo: không chuyển catch-all deny rồi allow exceptions của OpenCode
thẳng sang Claude. Installer hiện không sửa shared settings; mở rộng quản lý file
chung cần thiết kế ownership/conflict riêng.

## Guidance cho session mới

Docs ghi native `AGENTS.md` từ v2.1.277, với điều kiện mặc định không có
`CLAUDE.md`/`CLAUDE.local.md` ở CWD hoặc phía trên; một số session cũ không hỗ trợ.
`CLAUDE.md` có `@AGENTS.md` là cách import dùng chung và được docs hỗ trợ.
Một câu văn “hãy đọc AGENTS.md” chỉ được làm nếu model quyết định mở file.
Nguồn: [Memory / project instructions](https://code.claude.com/docs/en/memory).

Hệ quả cho repo: dùng wrapper import mỏng để session Claude nhận cùng quy trình,
không sao chép toàn bộ hướng dẫn. Kiểm tra `/context` trong session mới để xác
nhận guidance đã load; import đúng format không tự chứng minh runtime.

## Kiểm chứng cần làm khi mở rộng

- Ghi binary version, scope và skill cụ thể; thử explicit và implicit riêng.
- Kiểm tra command/skill trùng tên, resource và argument substitution.
- Với agent, thử main-thread launch và delegated launch riêng; xác minh quyền,
  parent mode, delegation target và việc preload skill.
- Không suy rộng kết quả local file sang plugin packaging.
