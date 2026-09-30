# Tương thích adapter

Cập nhật ngày 2026-09-30. Các định dạng và giới hạn dưới đây thuộc adapter hiện tại.

Nghiên cứu tài liệu chính thức ngày 2026-09-30 được lưu tại
[ghi chú harness](harnesses/README.md). Đây là bằng chứng docs, không thêm kết quả
runtime. Adapter OpenCode hiện theo **V1**; tài liệu V2 dùng schema khác và chưa
được ánh xạ. Trạng thái unsupported của Codex/Claude Code phản ánh adapter hiện
tại, không phải khẳng định harness không có custom agent hoặc command.

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

Các kiểm tra trước đợt activation smoke bên dưới dùng global filesystem context
tạm và discovery runtime project tạm. Smoke OpenCode dùng XDG config/data/cache/state
riêng và pure mode; discovery không tự chứng minh model thực thi workflow.

Claude Code đã được người dùng thử thủ công và xác nhận hoạt động ngày
2026-09-30, nên mục runtime smoke được đánh dấu hoàn thành. Chưa ghi nhận phiên
bản CLI, scope, skill cụ thể hoặc các bước thử; kết quả này không xác nhận riêng
toàn bộ 11 skill, cả hai scope hay hành vi invocation policy. Kết quả runtime
không suy rộng sang mọi phiên bản hoặc cấu hình permission do người dùng ghi đè.

## Activation smoke ngày 2026-09-30

Runner: [scripts/check-activation.mjs](../scripts/check-activation.mjs), hướng dẫn
chạy lại trong [development guide](adapter-development.md#smoke-activation-từ-checkout).
Các ca dùng core probe chỉ trả marker ngẫu nhiên, cùng adapter và installer thật,
home/project/XDG tạm, fresh model session cho mỗi request. Không sửa personal config
hoặc nội dung 16 asset. Đây là smoke của mapping activation, không phải thử toàn bộ
workflow thật. Report lưu tại [activation evidence](runtime/activation-2026-09-30.json).

| Harness | Scope | Discovery | Explicit / implicit / matching-request đối chứng |
|---|---|---|---|
| Codex CLI 0.157.1 | Project và global | Probe được app-server phát hiện, enabled; không có loader error | Explicit trả marker; implicit với activation explicit không trả marker; đối chứng matching-request trả marker |
| OpenCode 1.18.33, V1, deepseek/deepseek-flash | Project và global | `debug skill` nhận tên và body probe ở cả hai activation | Cả sáu lượt hoàn thành: explicit và đối chứng đều trả marker; implicit với activation explicit vẫn nạp skill ở project, trả NO_MATCH ở global; explicit-only vẫn limited |
| Claude Code | Chưa chạy tại máy này | CLI không có; người dùng xác nhận dùng môi trường khác | Runner đã chuẩn bị để người dùng chạy; chưa ghi phiên bản hoặc kết quả mới |

Codex dùng client-default trong home tạm, app-server báo `gpt-6-astra`, không nạp
user config. Cả sáu lượt model
thành công sau khi cho process truy cập mạng ngoài sandbox của môi trường kiểm thử.
`skills/list` của binary này không trả policy; kết quả discovery không tự chứng minh
native enforcement. Mã policy render được kiểm tra riêng; smoke chỉ xác nhận hành
vi quan sát được với probe/prompt này, không suy rộng sang mọi prompt hay overrides.

OpenCode thử lại ngoài sandbox với DeepSeek cho kết quả inference hợp lệ. Một
lượt project tự nạp skill explicit-only dù có description guard, nên guard không
bảo đảm manual-only; kết quả global khác không chứng minh có enforcement theo
scope. Đây là các lượt độc lập, không phải so sánh scope có kiểm soát độ ngẫu nhiên.
Chẩn đoán OpenAI xác nhận API báo hết credits; runner hiện bật log trong bộ nhớ
để phân loại `quota`, không lưu log thô. Những lượt cũ bị chặn DNS trong sandbox
hoặc timeout không dùng để kết luận activation. Tên DeepSeek cũ `deepseek-chat`
không có trong danh sách API hiện tại; lượt mới dùng `deepseek-flash`.
Runner cũng đặt `PWD` đúng project tạm: OpenCode 1.18.33 đã chọn project từ `PWD`
kế thừa dù process có cwd tạm. Evidence OpenCode mới thay thế kết luận scope từ
những lượt cũ; không sửa adapter hay personal config.
Claude giữ nguyên bằng chứng manual trước đó, không nâng kết quả đó thành bộ ba ca
mới. Người dùng sẽ chạy runner tại môi trường Claude Code của họ.

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
