# Claude Code: ghi chú nền tảng

Ngày đọc: **2026-09-30**. Phạm vi local Claude Code; docs có tính năng theo phiên
bản, không mặc định binary của người dùng có mọi tính năng mới. Kết quả adapter
và runtime xem [compatibility](../compatibility.md).

## Baseline tham chiếu adapter — ghi nhận 2026-10-01

Baseline này tổng hợp bằng chứng đã lưu; không phải lượt đọc docs/runtime mới.

| Thuộc tính | Mốc tham chiếu |
|---|---|
| Adapter | `claude-code`, revision `1`; `adapters/claude-code/index.ts` |
| Target mapping | Local Claude Code skill format, `.claude/skills`, global/project |
| Binary dùng khi phát triển ban đầu | Chưa ghi nhận |
| Ngày đọc docs đã lưu | 2026-09-30; URL docs không pin vào release |
| Nguồn mapping | [Skills — discovery, invocation control và arguments](https://code.claude.com/docs/en/skills); quy tắc được tóm tắt ở mục Skill, command và activation bên dưới |
| Quy tắc | Dịch activation sang `disable-model-invocation`, argument hint sang native frontmatter; không sinh command trùng skill; agent chưa mapping |
| Tests | `tests/core-adapter.test.ts`, `tests/lifecycle.test.ts` |
| Runtime tham chiếu | User xác nhận thủ công ngày 2026-09-30; chưa ghi binary version/scope/skill; xem [compatibility](../compatibility.md) |
| Chưa xác minh | Không có version range được chứng minh; mốc tính năng v2.1.277 của guidance bên dưới không phải target version của skill adapter |

Các mục agent, permission và guidance bên dưới là nghiên cứu nền tảng, không
phải các mapping đã implement. Khi đổi mapping, thêm baseline mới và giữ mốc
này để đối chiếu theo [quy tắc hồ sơ](README.md).

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

## Revision 2 — refactor và diagnostic ngày 2026-10-09

Adapter revision 2 dùng public core contract 3, definition schema 1; interface và
render helpers thuộc adapters, không import tool. Guard từ chối contract/version
hoặc vocabulary field lệch trước check/render. display_name/short_description chưa được mapping và giờ báo limited; argument_hint vẫn được render như cũ.

Native format và target giữ nguyên baseline revision 1 ở trên. Không mở lại
official docs trong lượt refactor này; ngày đọc nguồn vẫn 2026-09-30, không thêm
bằng chứng runtime mới. Test `tests/adapter-contract.test.ts` so 67 output hashes
của catalog trên ba adapter với commit 55f0a81; output byte không đổi. Revision 1
được giữ để đối chiếu; giới hạn và trạng thái hiện tại xem compatibility.
