# Claude Code: native baseline

Target: local `.claude/skills` và `.claude/agents`, global/project. Adapter
`claude-code`, revision **3**; code `adapters/claude-code/index.ts`. Skills giữ
baseline **2026-09-30**; subagent docs đọc **2026-10-22**, không pin release.
Máy phát triển chưa có Claude Code binary; output mới chưa được owner/runtime test.

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

### Delegated agents (revision 3)

- Project `.claude/agents/<id>.md`, global `~/.claude/agents/<id>.md`.
  Frontmatter có `name`, `description`, `tools`; body giữ nguyên core instructions.
- `tools: [Read, Glob, Grep]` là subagent tool allowlist, khác skill `allowed-tools`.
  Không inherit Bash, write/edit, Agent, AskUserQuestion hay MCP tools; không bật
  memory vì memory có thể tự thêm quyền ghi.
- Chỉ map delegated role với workspace_read allow và workspace_write/shell/
  questions/delegation deny; write_paths/delegation_targets phải rỗng. Agent resources,
  primary role và policy khác bị chặn. Không ghi shared settings, không set model
  hoặc permissionMode, không thay enforcement bằng instructions.
- Claude Code cũng cho chạy agent bằng `--agent` ở main thread; adapter này chỉ
  công bố delegated mapping, không coi khả năng đó là hỗ trợ core primary role.

Nguồn: [Subagent files và scopes](https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope),
[tool allowlist](https://code.claude.com/docs/en/sub-agents#restrict-which-tools-a-subagent-can-use),
[permission modes](https://code.claude.com/docs/en/sub-agents#permission-modes),
[memory tự bật quyền ghi](https://code.claude.com/docs/en/sub-agents#enable-persistent-memory).
Đây là cơ sở mapping, không phải bằng chứng output đã chạy đúng trong harness.

## Lưu ý khi mở rộng

Những capability đã research dưới đây **chưa được adapter implement**:

- [Subagents](https://code.claude.com/docs/en/sub-agents): primary role, policy khác
  read-only subset và agent resources chưa mapping. Delegation restrictions và
  permissionMode khác giữa main/subagent; không suy rộng subset đã hỗ trợ.
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
