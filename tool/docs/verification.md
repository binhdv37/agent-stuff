# Owner-testing records

Dành cho owner và coding agent được yêu cầu ghi nhận kết quả dùng thử. Quy tắc
testing ở [testing guide](../../docs/testing.md); module `tool/src/verification/`
chỉ validate dữ liệu, tính fingerprint và generate summary, không chạy model hay
tự xác nhận thay owner.

## File và format

Một ledger duy nhất: `verification/owner-tests.yaml`. Ban đầu `records: []`;
không tạo record cho các asset chưa được owner xác nhận dùng thử. Mỗi bộ
asset/harness/scope có một record gần nhất; lịch sử nằm trong Git.

```yaml
schema_version: 1
records:
  - asset: skill/example
    harness: claude-code
    scope: project
    tested_on: 2026-10-01
    result: works
    fingerprint: <SHA-256 từ lệnh fingerprint cho output đã thử>
    notes: Ghi chú hoặc giới hạn, có thể bỏ field này.
```

Ví dụ là format, không phải xác nhận thực tế; asset và fingerprint phải thay bằng
giá trị hợp lệ. Fields bắt buộc ngoài `notes`; field lạ, target trùng, ngày không
hợp lệ hoặc asset không tồn tại bị từ chối. `harness`: `opencode`, `codex`,
`claude-code`; `scope`: `project` hoặc `global`.

| Result | Ý nghĩa do owner xác nhận |
|---|---|
| `works` | Dùng được theo kỳ vọng của owner trong lần thử |
| `has-issues` | Đã thử và có vấn đề |
| `needs-retest` | Owner muốn thử lại, chưa coi là ổn |

Không cần scenario matrix, transcript, evidence bundle, model hoặc CLI version.
Có thể ghi version và giới hạn đã biết trong notes. Approval hay repository tests
passed không đủ để thêm `works`. Không migrate model runs cũ thành owner testing.

## Ghi nhận và kiểm tra

1. Khi owner yêu cầu lưu xác nhận, xác định asset, harness/scope, ngày và kết quả
   họ đã thử. Chỉ hỏi thêm phần còn thiếu cần thiết; không suy rộng scope.
2. Lấy fingerprint từ checkout/output tương ứng với bản đã thử. Nếu owner thử trên
   máy hoặc revision khác, xác định bản đó trước; không lấy hash hiện tại để gán
   cho một bản cũ chưa rõ. Không tự đổi fingerprint khi output thay đổi.
3. Cập nhật ledger và regenerate summary trong phạm vi documentation approval.

```bash
npm run build
npm run verification -- fingerprint --asset skill/bdv-code-review --harness claude-code
npm run verification -- validate
npm run verification -- report
npm run verification -- report --check
```

Thêm `--source /path/to/checkout` khi cần. Lệnh `fingerprint` chỉ in hash, không ghi
record. Không có lệnh tự đánh dấu đã thử hay gate `--require-passed`.

Fingerprint tính từ đường dẫn/nội dung files do adapter render và dependencies
được khai báo qua workflow/delegation. Output giống nhau giữ cùng hash; sửa docs,
tests hay refactor không đổi output không làm mất freshness. Quan hệ chỉ viết
trong prose không tự thành dependency: ví dụ skill và reviewer cần record riêng.
Hash không phát hiện thay đổi harness/model hoặc edits thủ công ở máy đã cài.

Summary tại `verification/README.md` hiển thị kết quả owner nói cùng trạng thái
output hiện tại. Hash khác: **Changed since test**; mapping hiện unsupported:
**Unavailable**. Cả hai vẫn giữ nguyên kết quả/ngày cũ, không tự chuyển thành
thành công hay thất bại mới. Mapping support và owner testing là hai thông tin riêng.

`npm test` kiểm integrity của ledger và summary; ledger rỗng hoặc output đã đổi
không chặn commit. `validate` kiểm dữ liệu, không chứng minh owner thực sự đã thử.
Format formal bốn stages và hồ sơ smart-commit stale đã được bỏ; lịch sử giữ ở Git.
Evidence adapter/refactor còn giá trị tiếp tục nằm dưới `verification/adapters/`
và `verification/system/`, không được coi là owner-testing records.
