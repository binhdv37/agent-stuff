# Phát triển core và adapter

`core/` là nguồn nội dung chính. Mỗi asset chứa `definition.yaml`, hướng dẫn
Markdown nếu cần và resource được khai báo. Không sửa file sinh trong `dist/`.

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

- `tool/src/core/schema.ts`: schema nghiêm ngặt và policy trung lập.
- `tool/src/core/load.ts`: đọc nội dung, giữ byte resource, kiểm tra tham chiếu.
- `tool/src/adapter.ts`: contract, trạng thái compatibility, file đầu ra trong bộ nhớ.
- `tool/src/registry.ts`: danh sách adapter tích hợp.
- `adapters/`: native metadata, wrapper command và target directory.
- `tool/src/installation/index.ts`: plan, state, transaction và recovery.
- `tool/src/cli.ts`: tương tác và dispatch.

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

`npm test` kiểm tra schema, migration hash, policy, resources, scope, CLI,
update/uninstall, conflict, rollback và recovery sau SIGKILL. Test chỉ dùng
filesystem tạm. Kiểm tra runtime harness được ghi riêng trong compatibility;
unit test không chứng minh hành vi model.

```bash
npm pack --pack-destination /path/to/output
```

Prepack build TypeScript. Gói gồm CLI/adapters đã compile và core; không gồm
prompts cá nhân, fixture hoặc nội dung legacy. Có thể cài tgz bằng npm trong
prefix riêng để thử command `agent-stuff`. Repo chưa publish package hoặc release.
