# Phát triển core và adapter

`core/` là nguồn nội dung chính. Mỗi asset chứa `definition.yaml`, hướng dẫn
Markdown nếu cần và resource được khai báo. Không sửa file sinh trong `dist/`.
Xem [concepts](concepts.md) cho định nghĩa i-skill/i-command/i-agent và
[core development](core-development.md) cho flow author và mở rộng contract.
Theo [quy trình mapping harness](harness-development.md) khi đổi adapter hoặc
thiết kế cấu hình native riêng theo asset.

## Chạy CLI

Yêu cầu Node.js 22+ và npm. Installer hiện được kiểm tra trên macOS; launcher
Bash và cơ chế sync filesystem hướng tới macOS/Linux, chưa hỗ trợ Windows native.

```bash
npm ci
npm run build
npm test
npm run cli -- validate
npm run cli -- list
npm run cli -- install
```

Lệnh install tương tác chọn harness, global/project, asset rồi xác nhận bản xem
trước. Enter ở bước chọn asset lấy các asset tương thích; danh sách không hỗ trợ
và lý do được hiển thị trước đó. Không có terminal thì phải truyền đủ flags.

Ví dụ build không cài vào cấu hình cá nhân:

```bash
npm run cli -- build --agent codex --compatible-only --out dist/codex-preview
```

`--out` phải là thư mục mới. `--source` nhận đường dẫn checkout có `core/`; mặc định
là nội dung cùng package CLI. Source và project đích độc lập.

```bash
npm run cli -- install --agent opencode --scope project --project /path/to/project \
  --only skill/bdv-api-handoff --only command/bdv-change-report --dry-run
```

Để áp dụng, bỏ `--dry-run`, thêm `--yes` và `--accept-limitations` nếu selection
có giới hạn. `--only` lặp được, nhận khóa `skill/id`, `command/id` hoặc `agent/id`.
`--compatible-only` là lựa chọn chủ động bỏ asset unsupported và vẫn in lý do;
không dùng flag này cho update vì không được âm thầm bỏ qua asset đã cài.

## Schema và adapter

- `core/src/index.ts`: entrypoint public cho schema/docs/catalog/selection/path helpers.
- `core/src/schema.ts`: schema nghiêm ngặt và policy trung lập; không import trực tiếp từ consumer.
- `core/src/catalog.ts`: đọc nội dung, giữ byte resource, kiểm tra tham chiếu.
- `tool/src/adapter.ts`: contract, trạng thái compatibility, file đầu ra trong bộ nhớ.
- `tool/src/registry.ts`: danh sách adapter tích hợp.
- `adapters/`: native metadata, wrapper command và target directory.
- `tool/src/installation/index.ts`: plan, state, transaction và recovery.
- `tool/src/cli.ts`: tương tác và dispatch.

Core không phụ thuộc tool hoặc adapter. `loadCatalog` nhận core root; CLI và
verification resolve `--source` checkout thành `<source>/core` tại biên gọi.
Build dọn các thư mục output TypeScript trong dist trước khi compile để file
của module đã chuyển/xóa không lọt vào npm pack; giữ các thư mục preview khác.

Command v1 tham chiếu skill. OpenCode inline workflow cùng wrapper đối số; workflow
có resource hoặc cú pháp interpolation native bị chặn trong đường command này.
Codex/Claude Code dùng skill tương ứng; không sinh command riêng trong adapter.

Policy agent có mặc định deny, role primary/delegated và write_paths tương đối.
OpenCode hỗ trợ policy cơ bản và scoped write vào thư mục plan. Khi hạn chế ghi,
shell phải deny; delegation chỉ được mở đến agent phụ chỉ đọc được khai báo trong
`delegation_targets`. Chọn planner tự thêm helper vào selection.

## Vòng đời file

`install` thêm/cập nhật selection; không gỡ các asset ngoài selection. `update`
lấy selection và source từ manifest, trừ khi truyền source hoặc selection cụ thể.
File/resource không còn trong asset mới được lên kế hoạch remove. Asset đã cài
không còn trong catalog cũng được gỡ sau preview; catalog rỗng vẫn là lỗi validate,
trường hợp muốn gỡ tất cả dùng uninstall.

```bash
npm run cli -- update --agent codex --scope global --dry-run
npm run cli -- uninstall --agent codex --scope global --only skill/bdv-api-handoff --dry-run
```

Manifest ở `<base>/.agent-stuff/installations/<scope>/<harness>.json`, với base là
home hoặc project. Lưu target, adapter version, source local, hash và asset owner
của từng file. Source là checkout/package local, chưa có cơ chế tải release hoặc
lịch sử source riêng cho từng asset. Dùng cùng một catalog cho một installation.

File chưa được quản lý hoặc file đã sửa cục bộ gây conflict. Kể cả nội dung
trùng nhau, file chưa được quản lý cũng không tự được nhận quyền sở hữu. CLI không
có flag ép ghi đè; cần tự backup/di chuyển file xung đột. Uninstall chỉ gỡ file
tracked chưa sửa, giữ file lạ và có thể để lại thư mục rỗng.

## Transaction và recovery

Trước khi sửa file, installer ghi journal có bản sao nội dung trước/sau và
manifest trước/sau. Ghi file bằng temp + rename, sync dữ liệu và directory;
manifest được commit sau cùng. Lock lưu PID/host và được tạo độc quyền.
Lỗi bắt được trong tiến trình được rollback; nếu file bị sửa bên ngoài thì
rollback dừng, giữ journal và báo conflict.

```bash
npm run cli -- recover --agent codex --scope global --yes
```

Recover chỉ gỡ lock của tiến trình đã kết thúc trên cùng host. Nếu manifest mới
đã commit, recover hoàn tất transaction; nếu chưa, khôi phục nội dung trước đó.
Nếu người dùng sửa file sau crash, recovery giữ nguyên file và journal để xử lý
thủ công. Uninstall/recover không cần source còn tồn tại.

Giới hạn: đây không phải cơ chế chống một tiến trình khác cố ý đổi đường dẫn giữa
lúc kiểm tra và ghi. Chưa kiểm chứng mất điện, network filesystem hoặc Windows.
Đã kiểm tra crash bằng cách kill tiến trình thật. Khi PID bị tái sử dụng hoặc lock
thuộc host khác, recovery từ chối thay vì đoán rằng lock đã cũ.

## Kiểm chứng và đóng gói

Quy định và hồ sơ từng stuff ở [testing guide](testing.md); xem
[bảng tổng hợp](verification/README.md) cho trạng thái gần nhất. Tooling
`npm run verification` quản lý báo cáo development trong checkout, không cài
hoặc sửa file harness. Vòng đời file đã cài vẫn thuộc shared installer.

### Smoke activation từ checkout

Runner riêng tại `scripts/check-activation.mjs` tạo core probe tạm, render qua
adapter và cài qua shared installer. Probe chỉ trả marker ngẫu nhiên; không thay
workflow/inventory thật. Mỗi scope có ba ca model độc lập: gọi explicit với
activation explicit, request chỉ khớp description với activation explicit, rồi
cùng request đó với matching-request làm đối chứng. Marker không có trong request.

```bash
npm run build

# Discovery: không gọi model; binary thiếu được báo skip
node scripts/check-activation.mjs --harness codex
node scripts/check-activation.mjs --harness opencode

# Model smoke: global và project, tổng cộng 6 lượt nếu không gặp lỗi runtime
node scripts/check-activation.mjs --harness codex --run-models \
  --auth-file /path/to/codex/auth.json --output /tmp/codex-activation.json
node scripts/check-activation.mjs --harness opencode --run-models \
  --model provider/model --auth-file /path/to/opencode/auth.json \
  --output /tmp/opencode-activation.json
```

`--scope project|global|both` mặc định both; `--binary /path/to/cli` chọn binary;
`--model` chọn model; `--timeout-ms` mặc định 120000 cho mỗi process.
`--auth-file` chỉ được copy khi gọi model; chỉ dùng với một harness, và file phải
có đúng native auth format. Runner xóa context tạm sau mỗi ca; không ghi lại auth
hay raw stderr vào report. Các biến auth như `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
và `CLAUDE_CODE_OAUTH_TOKEN` được kế thừa; config/discovery injections bị loại.
Provider config/plugin cá nhân không được copy, nên credential phụ thuộc gateway
hoặc plugin riêng có thể không hoạt động. Chọn provider chuẩn có auth hoạt động.
Runner đặt cả cwd và `PWD` vào project tạm; OpenCode 1.18.33 dùng `PWD` khi tạo
session. OpenCode model runs bật `--print-logs` để nhận diện lỗi quota/billing
trong bộ nhớ, nhưng report chỉ giữ category, không lưu log thô. API key hợp lệ
và model có trong danh sách chưa chứng minh tài khoản còn credits để inference.

Codex discovery dùng app-server `skills/list`; API này trong binary đã thử không
trả policy, nên report ghi null, không suy ra policy bị thiếu. Model runs dùng
`codex exec` read-only và ephemeral. OpenCode dùng `--pure`, discovery qua
`debug skill`, chỉ mở tool skill; explicit case là user yêu cầu tool nạp skill,
không phải một slash entry native của V1. Không dùng `--bare` cho Claude vì flag
đó bỏ discovery skill. Nguồn: [Codex app-server](https://learn.chatgpt.com/docs/app-server),
[Claude headless](https://code.claude.com/docs/en/headless).

### Chạy Claude Code ở môi trường khác

Chuẩn bị auth qua biến môi trường để dùng home tạm. API key dùng
`ANTHROPIC_API_KEY`; tài khoản subscription có thể tạo token bằng `claude setup-token`
và đặt `CLAUDE_CODE_OAUTH_TOKEN` trong môi trường chạy.
Nguồn: [Claude CLI](https://code.claude.com/docs/en/cli-reference).

```bash
npm run build
node scripts/check-activation.mjs --harness claude-code --run-models \
  --output /tmp/claude-activation.json
```

Có thể thêm `--binary` hoặc `--model` nếu cần. Runner gọi `claude --print`,
stream-json, không lưu session, chỉ mở/pre-approve Skill và deny MCP. Đây là
đường chạy chuẩn bị theo docs, **chưa chạy tại máy hiện tại vì thiếu Claude CLI**.
Sau khi chạy, gửi report JSON để cập nhật compatibility; không gửi auth file/token.

Exit code 0 nghĩa các ca đã yêu cầu chạy xong và không có lỗi được phát hiện;
1 là lỗi setup/discovery hoặc activation vi phạm ở harness được báo supported;
2 là thiếu binary, lỗi model/runtime hoặc đối chứng chưa quan sát được. OpenCode
limited có thể quan sát implicit activation mà runner không coi là regression.
Đọc verdict và đối chứng cùng nhau; một lần không gọi skill không chứng minh
enforcement. Kết quả chỉ áp dụng cho prompt, binary, model và config đã thử.

### Test và package

`npm test` kiểm tra schema, migration hash, policy, resources, scope, CLI,
update/uninstall, conflict, rollback và recovery sau SIGKILL. Test chỉ dùng
filesystem tạm. Kiểm tra runtime harness được ghi riêng trong compatibility;
unit test không chứng minh hành vi model.

```bash
npm pack --pack-destination /path/to/output
```

Prepack build TypeScript. Gói gồm CLI/adapters đã compile và core; không gồm
fixture hoặc nội dung legacy. Có thể cài tgz bằng npm trong
prefix riêng để thử command `agent-stuff`. Repo chưa publish package hoặc release.
