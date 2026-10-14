# CLI và shared installer

Dành cho người cần dùng CLI chi tiết hoặc sửa installer/build. [README](../README.md)
là hướng dẫn end user. Tool điều phối public API core/adapter; installer quản lý
filesystem, selection/confirmation, manifest và recovery. Không định nghĩa lại
contract core hoặc native mapping.

## Chạy từ checkout

Node.js 22+, npm và Git. Filesystem installer đã test trên macOS; launcher/sync
hướng tới macOS/Linux, chưa hỗ trợ Windows native.

```bash
npm ci
npm run build
npm test
npm run cli -- validate --source .
npm run cli -- list
npm run cli -- install
```

`bash install.sh` chuẩn bị dependencies/build rồi gọi CLI. CLI dùng `@clack/prompts`
cho menu harness/scope và checkbox asset theo nhóm, có mô tả ngắn; unsupported bị
disable kèm lý do. Arrow keys di chuyển, Space chọn, Enter tiếp tục; mặc định không
chọn asset nào, A chọn tất cả compatible một cách chủ động. Project path phải nhập
rõ (hỗ trợ `~/`); path sai được nhập lại, chọn source checkout cần confirm riêng.
Preview và limitations vẫn cần review/accept trước apply. Escape/Ctrl+C hoặc từ
chối confirm báo `Cancelled. No files changed.`; install thành công gợi ý cách dùng
item đã chọn. Không có terminal hoặc dùng `--yes` thì truyền đủ flags.
CLI báo các flags bắt buộc còn thiếu cùng lúc; lỗi input nêu flag/value và cách sửa.
`--only` thiếu kind hoặc gõ sai gợi ý full key gần nhất; tên trùng giữa các kind
được liệt kê để người dùng chọn rõ.

Compatibility ở cả interactive và script dùng bảng Item/Support/Details, hoặc rows
khi terminal hẹp; mỗi field bị ảnh hưởng dẫn tới note giải thích effect, effect chung chỉ xuất
hiện một lần. Supported không in boilerplate invocation. Preview nêu target, tổng số
file create/update/remove/unchanged và nhóm theo thư mục đích thay vì liệt kê từng
file; conflicts luôn hiện đầy đủ nguyên nhân và cách xử lý. `--verbose` hiện từng
file với path tương đối với target và đầy đủ reason/effect cho mỗi field compatibility.
Compatibility vẫn chỉ in một lần. Apply dùng progress bar tự
render (cyan `█` fill + `░` empty, kèm %) fill từ trái sang phải với ease-out (~900ms)
để install nhanh vẫn có cảm giác hoàn tất; màu tôn trọng `NO_COLOR` và output không
TTY. Success báo số item và file created/updated/removed/unchanged trước location
và Next step. Failure dừng bar rồi giữ lỗi gốc.

```bash
npm run cli -- build --agent codex --compatible-only --out dist/codex-preview
npm run cli -- install --agent codex --scope project --project /path/to/project \
  --only skill/bdv-api-handoff --dry-run
```

- `--out` phải là thư mục mới. Build không cài vào personal config.
- `--source` là checkout/package có core, mặc định source cùng CLI; project đích
  độc lập. Tool resolve `<source>/core`; thư viện core chỉ nhận core root.
- `--only` lặp được, dùng `skill/id`, `command/id`, `agent/id`; planner tự thêm helper.
- `--dry-run` chỉ preview. Bỏ flag để confirm/apply; script dùng `--yes`.
- Limited cần `--accept-limitations` sau review. `--yes` không chấp nhận thay,
  không vượt conflict/unsupported/contract mismatch. `--compatible-only` chủ động
  bỏ unsupported, báo lý do; không dùng cho update để âm thầm bỏ asset đã cài.
  Non-interactive thiếu acceptance dừng trước preview thay đổi, nhưng vẫn hiện
  compatibility; `--dry-run` vẫn preview và conflicts luôn được hiện để xử lý.

## Lifecycle và state

```bash
npm run cli -- update --agent codex --scope global --dry-run
npm run cli -- uninstall --agent codex --scope global --only skill/bdv-api-handoff --dry-run
npm run cli -- recover --agent codex --scope global --yes
```

Install thêm/cập nhật selection, không gỡ phần ngoài selection. Update mặc định
dùng source/selection đã ghi trong manifest; có thể truyền lại. File/resource hoặc
asset biến mất được lên kế hoạch remove sau preview. Catalog rỗng là lỗi validate;
muốn gỡ tất cả dùng uninstall.

Manifest: `<base>/.agent-stuff/installations/<scope>/<harness>.json`, base là home
hoặc project. Nó lưu target, source local, adapter revision, file hashes và owner.
Một installation dùng một catalog; chưa tải release hoặc lưu source riêng từng asset.
Legacy adapter revision 1 vẫn đọc được; uninstall/recover không cần source còn tồn tại.

Conflict phân biệt file đã sửa từ lúc cài, file unmanaged có sẵn (kể cả cùng nội
dung), hoặc path được ghi dưới owner khác. Preview nêu nguyên nhân, item, path tương
đối với target và cách xử lý. Một conflict chặn toàn bộ selection: không đổi file
hay state cài đặt; `--yes` không bỏ qua và không tự overwrite/adopt.

Để giữ nội dung, di chuyển file conflict ra ngoài target rồi retry; với file đã
sửa, có thể khôi phục đúng nội dung lúc cài thay thế. Chỉ copy backup không giải
quyết conflict vì file gốc vẫn còn. Uninstall có thể dùng `--only` chọn item không
conflict để gỡ trước; item đã sửa vẫn được cài và tracked. Uninstall chỉ gỡ tracked
chưa sửa, giữ file lạ; có thể còn folder rỗng.

## Transaction và recovery

Installer check paths/symlinks và lock PID/host trước apply. Journal giữ file và
manifest trước/sau; ghi bằng temp + rename và sync, commit manifest cuối. Lỗi được
bắt rollback; external edit khiến rollback dừng và giữ journal.

Recover chỉ gỡ lock của process đã kết thúc trên cùng host. Manifest mới đã commit
thì hoàn tất transaction; chưa commit thì restore trạng thái trước. External edit
sau crash được giữ cùng journal để xử lý thủ công. PID tái sử dụng/host khác bị từ
chối thay vì đoán. Tests kill process thật; chưa kiểm mất điện, network filesystem
hoặc chống process cố ý đổi path giữa check/write.

## Phát triển và đóng gói

- `tool/src/cli.ts`: tương tác/dispatch; `tool/src/installation/index.ts`: plan,
  state, transaction/recovery. Test filesystem trong context tạm, không personal config.
- `tool/src/prompts.ts`: terminal UI/validation; `tests/interactive.test.ts` kiểm
  selection, cancellation, target và regression flag-driven. Smoke terminal thật
  cần kiểm phím điều hướng, Enter khi selection rỗng, path sai rồi nhập lại,
  từ chối source checkout, Escape/Ctrl+C và install thành công trong project tạm.
- Test core/adapter/lifecycle thuộc trách nhiệm tương ứng. Runtime/E2E theo
  [testing](../docs/testing.md); [verification tooling](docs/verification.md)
  quản lý hồ sơ, không chạy harness hay thay đổi file đã cài.
- Build dọn riêng output TypeScript core/adapters/tool/tests trước compile, giữ
  dist previews khác; copy core docs để API getDocs chạy độc lập.

```bash
npm pack --pack-destination /path/to/output
```

Prepack build. Gói gồm compiled modules, core content và tài liệu hiện hành được
link và hồ sơ verification được giữ lại; không đóng gói tests, plan/audit hoặc
output chạy tạm. Chưa publish package.
Smoke tarball trong thư mục tạm: API/docs/catalog, strict TypeScript consumer,
CLI validate/list/install dry-run từ ngoài checkout. Dependency symlink chỉ chứng
minh package contents, không chứng minh fresh registry install.

## Dùng bản cũ

Installer cũ không có manifest: file trùng đích gây conflict, cần backup/di chuyển;
không tự nhận ownership hoặc xóa cả folder skill. State thử nghiệm không có segment
`<scope>` không được tự nhập. Không dùng `npx skills add` hoặc installer cũ tải main;
chọn tag/commit bằng Git rồi chạy launcher, hoặc dùng tgz local.
