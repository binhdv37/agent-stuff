# Codex: native baseline

Target: local CLI/IDE, `.agents/skills`, global/project; không suy sang cloud/hosted.
Docs đọc **2026-09-30**, không pin release. Binary lúc author ban đầu: chưa ghi nhận.
Adapter `codex`, revision 3; code `adapters/codex/index.ts`. Revision 3 nhận core
contract 4 và `install_with` do installer xử lý, không đổi native mapping hoặc đọc
lại docs native. Quy tắc native giữ từ
revision 1; revision 2 chỉ refactor/diagnostic, không có lượt đọc docs mới.

## Mapping đang dùng

- `SKILL.md` cần name/description. Project quét `.agents/skills` từ CWD lên repo
  root; global `~/.agents/skills`. Trùng tên không merge, có thể hiện cả hai.
- Explicit qua `/skills` hoặc `$skill`. `agents/openai.yaml` chứa UI metadata và
  `policy.allow_implicit_invocation`: false ngăn implicit, vẫn cho explicit;
  default true. `skills.config.enabled = false` là tắt skill, khác manual-only.
- Core activation dịch chung trong adapter; resources giữ nguyên. argument_hint
  chưa mapping và báo limited; display_name/short_description được render.
- Agent/command riêng chưa mapping; không biến primary thành subagent.

Nguồn: [Build skills — discovery, metadata, invocation policy](https://learn.chatgpt.com/docs/build-skills).
Tests: `tests/core-adapter.test.ts`, `tests/lifecycle.test.ts`,
`tests/adapter-contract.test.ts`. Runtime: [compatibility](../compatibility.md).

## Lưu ý khi mở rộng

Những capability đã research dưới đây **chưa được adapter implement**:

- [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents): TOML
  `.codex/agents/`, spawned session, kế thừa parent permission/overrides.
  Read-only sandbox không tự đồng nghĩa cấm shell; cần test role và policy riêng.
- [Config](https://learn.chatgpt.com/docs/config-file/config-basic): project cần
  trust; ưu tiên CLI → project → profile → user → cloud defaults → system → built-in.
- [Permissions](https://learn.chatgpt.com/docs/permissions): profiles beta không
  trộn sandbox settings cũ; network domain rules phụ thuộc proxy.
- [Rules](https://learn.chatgpt.com/docs/agent-configuration/rules): prefix_rule
  allow/prompt/forbidden dùng quyết định chặt nhất, không last-match-wins.
- [Guidance](https://learn.chatgpt.com/docs/agent-configuration/agents-md):
  AGENTS.override ưu tiên AGENTS; project đọc root xuống CWD, budget mặc định 32 KiB.

Mở lại nguồn khi đổi mapping. Trang slash-command đã đọc là UI desktop, không là
bằng chứng command file CLI. Giữ core semantics khi thử cơ chế native khác.

## Mốc cũ

Baseline revision 1 ghi ngày 2026-10-01, docs 2026-09-30; runtime Codex 0.157.1.
Revision 2 (2026-10-09) giữ mapping, báo argument_hint limited, gate core contract 3.
Discovery mới: CLI 0.162.0, không model run. [Hồ sơ đầy đủ trước cleanup](https://github.com/binhdv37/agent-stuff/blob/0cbbc14/docs/harnesses/codex.md).
