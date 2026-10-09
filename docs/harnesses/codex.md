# Codex: ghi chú nền tảng

Ngày đọc: **2026-09-30**. Phạm vi local Codex CLI/IDE; tài liệu OpenAI hiện hành,
không xác nhận một phiên bản binary cụ thể. Bằng chứng adapter/runtime xem
[compatibility](../compatibility.md). Không áp dụng mặc định các cơ chế local
cho ChatGPT Work hosted hoặc Codex Cloud.

## Baseline tham chiếu adapter — ghi nhận 2026-10-01

Baseline này tổng hợp bằng chứng đã lưu; không phải lượt đọc docs/runtime mới.

| Thuộc tính | Mốc tham chiếu |
|---|---|
| Adapter | `codex`, revision `1`; `adapters/codex/index.ts` |
| Target mapping | Local Codex skill format, `.agents/skills`, global/project |
| Binary dùng khi phát triển ban đầu | Chưa ghi nhận |
| Ngày đọc docs đã lưu | 2026-09-30; URL docs không pin vào release |
| Nguồn mapping | [Build skills — discovery, SKILL.md và agents/openai.yaml](https://learn.chatgpt.com/docs/build-skills); quy tắc được tóm tắt ở mục Skill và activation bên dưới |
| Quy tắc | Dịch activation sang `policy.allow_implicit_invocation`, giữ resource và UI metadata; chưa mapping agent/command riêng |
| Tests | `tests/core-adapter.test.ts`, `tests/lifecycle.test.ts` |
| Runtime tham chiếu | Codex CLI 0.157.1, evidence ngày 2026-09-30 trong [compatibility](../compatibility.md#activation-smoke-ngày-2026-09-30) |
| Chưa xác minh | Không có version range được chứng minh; runtime version trên không chứng minh phiên bản dùng lúc author adapter |

Các mục custom agent, permission và guidance bên dưới là nghiên cứu nền tảng;
không đồng nghĩa adapter revision 1 đã implement các mapping đó. Khi đổi mapping,
thêm baseline mới và giữ mốc này để đối chiếu theo [quy tắc hồ sơ](README.md).

## Skill và activation

`SKILL.md` cần `name`, `description`. Project discovery quét `.agents/skills`
từ CWD lên repository root; user scope là `~/.agents/skills`. Trùng tên không
được merge, cả hai có thể xuất hiện trong selector. CLI/IDE gọi explicit qua
`/skills` hoặc `$skill`. Cấu hình riêng ở `agents/openai.yaml`:

```yaml
policy:
  allow_implicit_invocation: false
```

Giá trị mặc định là `true`; `false` ngăn implicit invocation, vẫn cho explicit.
File này cũng chứa UI metadata và dependencies. `[[skills.config]]` với
`enabled = false` trong user config tắt skill, khác manual-only.
Nguồn: [Build skills](https://learn.chatgpt.com/docs/build-skills).

Hệ quả cho repo: `activation` thuộc core; adapter dịch policy chung cho mọi skill.
Không dùng override theo asset chỉ để đổi tên tham số activation. Mapping nằm ở
`adapters/codex/index.ts`; resource được giữ qua `adapters/render.ts`.

## Custom agent và delegation

Docs local mô tả TOML ở `.codex/agents/` hoặc `~/.codex/agents/`, mỗi file cần
`name`, `description`, `developer_instructions`; có thể đặt model và sandbox.
Đây là cấu hình cho spawned sessions. Parent sandbox/permission được kế thừa;
live runtime overrides của parent được áp lại khi spawn, có thể khác default
trong file custom agent.
Nguồn: [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

Suy luận thiết kế: có nền tảng để nghiên cứu mapping delegated agent, nhưng
không đủ để coi policy core đã enforce được. Không biến primary role thành
subagent để vượt unsupported. Cần kiểm tra deny shell, deny delegation và scoped
writes riêng; read-only sandbox không tự đồng nghĩa với shell bị cấm.

## Quyền và thứ tự cấu hình

User config ở `~/.codex/config.toml`, project ở `.codex/config.toml`; project
layers cần trust. Ưu tiên cao xuống thấp: CLI, project gần CWD, selected profile,
user, cloud-managed defaults, system, built-in. Managed requirements là ràng
buộc riêng, không chỉ là default có thể override.
Nguồn: [Config basics](https://learn.chatgpt.com/docs/config-file/config-basic).

Permission profiles filesystem/network hiện được đánh dấu beta. Docs yêu cầu
chọn profiles hoặc sandbox settings cũ, không trộn; domain rules cần network
proxy hoạt động mới hạn chế direct network access.
Nguồn: [Permissions](https://learn.chatgpt.com/docs/permissions).

Shell `prefix_rule` dùng `allow | prompt | forbidden`, lấy quyết định chặt nhất
khi nhiều rule khớp. `allow` cho phép chạy ngoài sandbox không hỏi. Đây không phải
luật last-match-wins của OpenCode.
Nguồn: [Rules](https://learn.chatgpt.com/docs/agent-configuration/rules).

## Guidance và command

Codex đọc global `AGENTS.override.md` hoặc `AGENTS.md` dưới Codex home; project
đọc từ root xuống CWD, tối đa một file mỗi thư mục, ưu tiên override trước AGENTS.
File gần CWD xuất hiện sau; tổng budget mặc định 32 KiB.
Nguồn: [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

Trang slash commands được mở trong lượt này nói về ChatGPT desktop app, có
custom prompts và skills trong menu; không dùng nó để suy ra installer command
file portable cho CLI.
Nguồn: [Slash commands](https://learn.chatgpt.com/docs/reference/slash-commands).

Hệ quả cho repo: command vẫn tham chiếu skill; chưa thiết kế mapping command riêng
cho Codex. Khi cần, phải xác minh nguồn CLI cụ thể thay vì suy rộng UI desktop.

## Kiểm chứng cần làm khi mở rộng

- Ghi phiên bản CLI, chọn project/home tạm; kiểm tra discovery và tên bị trùng.
- So sánh explicit invocation với request chỉ khớp description.
- Với custom agent, thử boundary thực tế dưới parent overrides và trust settings.
- Xác minh lại permission profiles beta trước khi dùng cho policy core.

## Revision 2 — refactor và diagnostic ngày 2026-10-09

Adapter revision 2 dùng public core contract 3, definition schema 1; interface và
render helpers thuộc adapters, không import tool. Guard từ chối contract/version
hoặc vocabulary field lệch trước check/render. argument_hint chưa được mapping và giờ báo limited; display_name/short_description vẫn được render như cũ.

Native format và target giữ nguyên baseline revision 1 ở trên. Không mở lại
official docs trong lượt refactor này; ngày đọc nguồn vẫn 2026-09-30, không thêm
bằng chứng runtime mới. Test `tests/adapter-contract.test.ts` so 67 output hashes
của catalog trên ba adapter với commit 55f0a81; output byte không đổi. Revision 1
được giữ để đối chiếu; giới hạn và trạng thái hiện tại xem compatibility.
