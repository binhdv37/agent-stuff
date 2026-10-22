# Tương thích adapter

Trạng thái dưới đây là implementation hiện tại: OpenCode/Codex revision **2**,
Claude Code revision **3**, core contract **3**, YAML schema **1**. Supported mapping không đồng nghĩa workflow đã
verified; kết quả từng stuff nằm ở [verification](../../verification/README.md).

## Hỗ trợ

| Harness | Skills | Commands | Agents |
|---|---|---|---|
| OpenCode V1 | Skills/resources; explicit activation limited | Command riêng inline skill | Primary và helper delegated với policy được mapping |
| Codex | Skills/resources, UI metadata, invocation policy | Dùng skill tương ứng; command riêng unsupported | Unsupported |
| Claude Code | Skills/resources, slash entry, invocation policy | Dùng skill slash command; command riêng unsupported | Delegated chỉ đọc với tool allowlist; primary và policy khác unsupported |

Unsupported ở đây phản ánh adapter, không khẳng định harness thiếu capability.

| Field đã khai báo nhưng chưa mapping | Hệ quả |
|---|---|
| Codex: argument_hint | Không render input hint; báo limited |
| Claude Code: display_name, short_description | Không render UI metadata; báo limited |
| OpenCode: display_name, short_description, argument_hint | Không render UI/input hint; báo limited; command argument wrapper giữ nguyên |

OpenCode explicit-only dùng description guard, không có native enforcement trong
adapter. Một lượt model đã tự nạp skill dù explicit; không gọi guard là bảo đảm.
Limited cần chấp nhận trước apply. `--yes` không chấp nhận thay; `--compatible-only`
chỉ chủ động bỏ selection unsupported, không vượt contract mismatch. Installer
không sửa shared config. Xem [CLI](../../tool/README.md) cho lifecycle/conflict.

## Agent policy OpenCode

V1 dùng singular `permission`, catch-all deny trước exceptions:

- `solution-architect`: cấm ghi và shell; cho đọc workspace và hỏi user.
- `experimental-plan`: chỉ edit `.auragent/plans/*` trong workspace; bash và
  external_directory deny; task chỉ mở `bdv-plan-reviewer`.
- `bdv-plan-reviewer`: delegated chỉ đọc; edit/bash/task deny. Selection planner
  tự thêm helper. Policy giới hạn model delegation, không cấm user gọi helper trực tiếp.

OpenCode 1.18.32/1.18.33 đã nạp role/tool/permission qua debug runtime. Chưa có
phiên model đầy đủ chứng minh tạo plan và từ chối ghi ngoài plan directory.

## Agent policy Claude Code

Revision 3 render delegated agent thành `.claude/agents/<id>.md` ở project hoặc
`~/.claude/agents/<id>.md` ở global, dùng `tools: [Read, Glob, Grep]` làm allowlist.
Chỉ hỗ trợ workspace_read allow; workspace_write, shell, questions và delegation
deny; không có write_paths, delegation_targets hoặc agent resources. Các tổ hợp
khác bị chặn, không đổi role hay dùng prompt thay enforcement.

Mapping dựa trên [native baseline](harnesses/claude-code.md), chưa có owner/runtime
test cho output mới. Codex agent vẫn unsupported trong adapter.

## Phạm vi bằng chứng

| Lượt | Quan sát và giới hạn |
|---|---|
| [Activation 2026-09-30](../../verification/adapters/activation-2026-09-30.json) | Codex 0.157.1/gpt-6-astra, project/global: explicit và matching control trả marker, implicit-explicit không trả marker. OpenCode 1.18.33/deepseek-flash: implicit-explicit nạp skill ở project; global không nạp trong ca đã thử. Không suy rộng thành enforcement hoặc khác biệt scope chắc chắn. |
| [Discovery 2026-10-09](../../verification/system/core-module-boundary-2026-10-09.md) | Codex 0.162.0 và OpenCode 1.18.35 cài/discover probe ở cả scopes và activation; Claude blocked vì thiếu binary. Không có model behavior mới. |
| Claude manual 2026-09-30 | User xác nhận chạy được, nhưng thiếu CLI version/scope/skill/procedure; không đủ xác nhận mọi workflow hoặc activation. |

Probe không kiểm chứng từng workflow. Codex discovery không trả policy, null
không chứng minh thiếu policy. Report activation giữ cả network/quota failures;
các lượt đó không dùng để kết luận behavior. Evidence cũ không được đổi fingerprint
để thành lượt mới. Refactor revision 2 giữ native bytes (67 hashes đối chiếu trong
test), nhưng render regression không phải runtime evidence.

Nguồn/native baseline: [Codex](harnesses/codex.md),
[Claude Code](harnesses/claude-code.md), [OpenCode](harnesses/opencode.md).
Các version đã thử không là range tương thích được bảo đảm; CLI chưa gate version.
