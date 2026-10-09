# OpenCode: ghi chú nền tảng

Ngày đọc: **2026-09-30**. Có hai nhánh tài liệu chính thức: `/docs/` cho V1 và
`/v2/docs/` cho V2. Adapter hiện tại dùng V1; bằng chứng phiên bản 1.18.x xem
[compatibility](../compatibility.md). Không đổi native syntax theo V2 trong lượt này.

## Baseline tham chiếu adapter — ghi nhận 2026-10-01

Baseline này tổng hợp bằng chứng đã lưu; không phải lượt đọc docs/runtime mới.

| Thuộc tính | Mốc tham chiếu |
|---|---|
| Adapter | `opencode`, revision `1`; `adapters/opencode/index.ts` |
| Target mapping | Local OpenCode V1, `.opencode` project và `.config/opencode` global |
| Binary dùng khi phát triển ban đầu | Chưa ghi nhận; các mốc runtime 1.18.32/1.18.33 được lưu riêng |
| Ngày đọc docs đã lưu | 2026-09-30; nhánh `/docs/` V1, URL không pin vào release |
| Nguồn mapping | [V1 Skills](https://opencode.ai/docs/skills/), [V1 Commands](https://opencode.ai/docs/commands/), [V1 Agents](https://opencode.ai/docs/agents/), [V1 Permissions](https://opencode.ai/docs/permissions/); các mục tương ứng bên dưới tóm tắt quy tắc |
| Nguồn scoped write | [Write tool](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/write.ts), link nhánh `dev` không pin commit; tham chiếu đã lưu trong compatibility |
| Quy tắc | Skill discovery; command inline workflow; role và singular `permission`, catch-all trước exceptions; explicit activation chỉ là prompt guard |
| Tests | `tests/core-adapter.test.ts`, `tests/agent-policy.test.ts`, `tests/lifecycle.test.ts` |
| Runtime tham chiếu | OpenCode 1.18.32/1.18.33, các ca và giới hạn trong [compatibility](../compatibility.md) |
| Chưa xác minh | Không có version range được chứng minh; V2 chưa được mapping; nguồn code `dev` cần pin khi nghiên cứu lại |

Phần V2 bên dưới là nghiên cứu cho mở rộng, không thuộc target của adapter
revision 1. Khi đổi mapping, thêm baseline mới và giữ mốc này để đối chiếu theo
[quy tắc hồ sơ](README.md).

## V1: skill và activation

Discovery nhận `.opencode/skills/`, `~/.config/opencode/skills/`, cùng các location
tương thích `.claude/skills/` và `.agents/skills/` ở project/home. `SKILL.md`
nhận `name`, `description`, `license`, `compatibility`, `metadata`; field lạ bị
bỏ qua. `name` phải khớp folder, kebab-case, tối đa 64 ký tự; description 1–1024.
`permission.skill` cho allow/ask/deny theo pattern; deny ẩn và chặn load, ask hỏi
trước load. Có thể override permission theo agent hoặc tắt skill tool.
Nguồn: [V1 Skills](https://opencode.ai/docs/skills/).

Suy luận thiết kế: ask-before-load khác manual-only. Docs V1 đã đọc không nêu
native field manual-only tương đương Codex/Claude. Adapter dùng description guard
và báo limited; không đưa field Claude vào frontmatter rồi tuyên bố enforce.
Cross-harness discovery cần được xét khi thử nhiều bản cài cùng ID.

## V1: agent và delegation

Markdown agent ở `.opencode/agents/` hoặc `~/.config/opencode/agents/`; filename
là tên. Có mode primary/subagent, model, temperature và `permission`.
`permission.task` giới hạn target delegation bằng pattern; denied target bị
loại khỏi tool description. Docs phân biệt điều này với user gọi trực tiếp bằng
`@`, vẫn có thể gọi subagent.
Nguồn: [V1 Agents](https://opencode.ai/docs/agents/).

Hệ quả cho repo: planner/helper mapping kiểm soát model delegation, không phải
lệnh cấm user sử dụng helper độc lập. Scoped write, shell deny và target restrictions
phải giữ cùng nhau trong policy; không chỉ thêm prompt “read-only”.

## V1: command

Markdown ở `.opencode/commands/` hoặc `~/.config/opencode/commands/`; filename
thành `/name`. Có `$ARGUMENTS`, `$1`…; frontmatter hỗ trợ description, agent,
model, subtask. `subtask` có thể ép chạy trong subagent; shell interpolation
và file references có ngữ nghĩa native.
Nguồn: [V1 Commands](https://opencode.ai/docs/commands/).

Hệ quả cho repo: wrapper giữ đối số và workflow core. Adapter hiện chặn workflow
có resource hoặc interpolation native ở đường command; cần thiết kế riêng trước
khi mở rộng. Không xem một command trỏ agent là policy enforcement.

## V1: permission, config và guidance

Quyền ở singular `permission`; allow/ask/deny nhận pattern, last matching rule
wins. Catch-all phải đứng trước exceptions. `edit` gate cả write/edit/patch;
shell dùng `bash`, delegation dùng `task`.
Nguồn: [V1 Permissions](https://opencode.ai/docs/permissions/).

Config được merge: remote defaults → global → `OPENCODE_CONFIG` → project →
`.opencode` directories → inline config. Các key không xung đột được giữ.
Nguồn: [V1 Config](https://opencode.ai/docs/config/).

Guidance nhận `AGENTS.md`; `CLAUDE.md` là fallback. Global guidance ở
`~/.config/opencode/AGENTS.md`; `instructions` trong config có thể tham chiếu file
khác. Hai filename cùng tồn tại không có nghĩa cả hai đều được đọc.
Nguồn: [V1 Rules](https://opencode.ai/docs/rules/).

Hệ quả cho repo: test bằng context tạm để config cá nhân và compatibility discovery
không che mất kết quả. Installer không sửa global config chung của người dùng.

## V2: khác biệt cần nghiên cứu trước migration

V2 skills có `metadata.opencode/autoinvoke: false` để bỏ khỏi model-facing list,
vẫn registered và load được explicit theo ID. Đây là kiểm soát advertisement,
không phải mô tả một deny cho mọi model tool call. `slash` điều khiển menu; ID
được suy từ path, `name` chỉ là display label; trùng ID lấy source đăng ký sau.
Nguồn: [V2 Skills](https://opencode.ai/v2/docs/skills/).

V2 dùng plural `permissions` với array `{action, resource, effect}`, action
`shell` và `subagent` thay `bash`/`task`. Last-match-wins vẫn được mô tả; fallback
khi không khớp là ask; agent rules áp sau global.
Nguồn: [V2 Permissions](https://opencode.ai/v2/docs/permissions/).

Suy luận thiết kế: adapter hoặc mapping phải phân biệt version, không thay vài tên
field rồi coi migration hoàn tất. Cần kiểm tra agent/command schema, IDs, precedence,
discovery và quyền runtime của V2. Không nâng explicit invocation thành supported
chỉ vì model không thấy skill trong danh sách.

## Kiểm chứng cần làm khi mở rộng

- Chốt binary/version và nhánh docs trước khi sửa mapping.
- Kiểm tra config discovery trong context tạm, không gọi model nếu chỉ cần inspect.
- Nếu tuyên bố enforce behavior, thử tình huống được phép và bị cấm thực tế.
- Với V2, thử explicit load sau khi tắt advertisement và thử model load bằng ID.

## Revision 2 — refactor và diagnostic ngày 2026-10-09

Adapter revision 2 dùng public core contract 3, definition schema 1; interface và
render helpers thuộc adapters, không import tool. Guard từ chối contract/version
hoặc vocabulary field lệch trước check/render. display_name/short_description/argument_hint chưa được mapping và giờ báo limited; activation explicit vẫn là prompt guard/limited. Command wrapper và permission V1 giữ nguyên.

Native format và target giữ nguyên baseline revision 1 ở trên. Không mở lại
official docs trong lượt refactor này; ngày đọc nguồn vẫn 2026-09-30, không thêm
bằng chứng runtime mới. Test `tests/adapter-contract.test.ts` so 67 output hashes
của catalog trên ba adapter với commit 55f0a81; output byte không đổi. Revision 1
được giữ để đối chiếu; giới hạn và trạng thái hiện tại xem compatibility.
