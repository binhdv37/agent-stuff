# Claude Code: native baseline

Target: local `.claude/skills`, global/project. Docs đọc **2026-09-30**, không pin
release. Binary lúc author: chưa ghi nhận. Adapter `claude-code`, revision 2;
code `adapters/claude-code/index.ts`. Native mapping giữ từ revision 1;
revision 2 không có lượt đọc docs mới.

## Mapping đang dùng

- Project `.claude/skills/<id>/SKILL.md`, global `~/.claude/skills/`.
- `disable-model-invocation: true` giữ explicit `/name`, ngăn tự load.
  `user-invocable: false` chỉ ẩn user entry, vẫn cho model gọi: khác semantics.
- Skill có resources, argument-hint và slash entry; command riêng vẫn là native
  capability nhưng adapter dùng skill, không sinh bản trùng.
- `allowed-tools` cấp quyền không hỏi trong turn, không là allowlist giới hạn.
  Field lạ bị bỏ qua. Không dùng nó để chứng minh read-only.
- argument_hint được render; display_name/short_description chưa mapping, báo limited.

Nguồn: [Skills — invocation, arguments, command equivalence](https://code.claude.com/docs/en/skills).
Tests: `tests/core-adapter.test.ts`, `tests/lifecycle.test.ts`,
`tests/adapter-contract.test.ts`. Runtime: [compatibility](../compatibility.md).

## Lưu ý khi mở rộng

Những capability đã research dưới đây **chưa được adapter implement**:

- [Subagents](https://code.claude.com/docs/en/sub-agents): Markdown agents có tools,
  disallowedTools, permissionMode; `--agent` có thể chạy main thread. Delegation
  restrictions/parent mode khác giữa main và subagent; test cả hai trước mapping.
- [Permissions](https://code.claude.com/docs/en/permissions): deny → ask → allow;
  allow cụ thể không mở broad deny. Project allow cần trust. Không dịch máy móc
  catch-all deny/allow exceptions từ OpenCode.
- [Settings](https://code.claude.com/docs/en/settings): managed → CLI → project
  local → project → user; list có thể merge. Installer hiện không sửa shared settings.

## Guidance của repo

[Memory](https://code.claude.com/docs/en/memory) đã đọc mô tả AGENTS native từ
v2.1.277, có điều kiện không có CLAUDE.md/CLAUDE.local.md ở CWD/phía trên.
Wrapper `CLAUDE.md` với `@AGENTS.md` import cùng hướng dẫn, không sao chép body.
Mốc guidance không phải target version của skill adapter; `/context` mới xác nhận
guidance thực sự load. Không suy file đúng format thành runtime success.

## Mốc cũ

Baseline revision 1 ghi ngày 2026-10-01, docs 2026-09-30. User xác nhận thủ công
nhưng thiếu binary/scope/skill. Revision 2 (2026-10-09) giữ native format, báo UI
metadata limited và gate core contract 3; discovery blocked vì thiếu CLI.
[Hồ sơ đầy đủ trước cleanup](https://github.com/binhdv37/agent-stuff/blob/0cbbc14/docs/harnesses/claude-code.md).
