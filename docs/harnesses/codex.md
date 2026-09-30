# Codex: ghi chú nền tảng

Ngày đọc: **2026-09-30**. Phạm vi local Codex CLI/IDE; tài liệu OpenAI hiện hành,
không xác nhận một phiên bản binary cụ thể. Bằng chứng adapter/runtime xem
[compatibility](../compatibility.md). Không áp dụng mặc định các cơ chế local
cho ChatGPT Work hosted hoặc Codex Cloud.

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
`adapters/codex/index.ts`; resource được giữ qua `tool/src/render.ts`.

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
