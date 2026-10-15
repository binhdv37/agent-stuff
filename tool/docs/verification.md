# Tooling verification và format hồ sơ

Dành cho người ghi hồ sơ hoặc sửa `tool/src/verification/`. Tool validate hồ sơ,
tính fingerprints và generate summary; **không tự chạy harness**. Chọn target và
scenario theo [testing](../../docs/testing.md). Kết quả nằm ngoài docs, tại
`verification/`; cần checkout đầy đủ để tính fingerprint, không dùng package thiếu
source adapter/tool làm baseline.

## Lệnh

```bash
npm run build
npm run verification -- fingerprint --asset skill/bdv-product-brief --harness codex
npm run verification -- validate
npm run verification -- report
npm run verification -- report --check
npm run verification -- validate --require-passed \
  --asset skill/bdv-product-brief --harness codex
```

Truyền `--source /path/to/checkout` khi gọi từ nơi khác. Capture fingerprint trước
test; source đổi trong lúc test thì chạy lại, không sửa hash của lượt cũ. `validate`
check schema/identity, evidence path/hash và kết quả; không chứng minh lời ghi là
đúng thực tế. `report` generate `verification/README.md`; `--check` phát hiện lệch.
Gate lỗi nếu thiếu hồ sơ, chưa Passed hoặc stale. `npm test` check integrity/summary,
không đòi mọi stuff Passed. Summary chỉ tóm tắt, chi tiết nằm trong hồ sơ.

## Format và nơi lưu

Schema strict: `tool/src/verification/index.ts`. Mỗi stuff/harness có một hồ sơ
`verification/stuff/<kind>/<id>/<harness>.yaml`; scope/scenario nằm trong hồ sơ.
Evidence dưới `verification/stuff/evidence/<kind>/<id>/<harness>/`.
Ví dụ chưa test (placeholder phải thay bằng hash thật):

```yaml
schema_version: 1
asset: skill/bdv-product-brief
harness: codex
checked_at: null
fingerprint:
  core: <hash từ fingerprint>
  implementation: <hash từ fingerprint>
environment:
  harness_version: null
  adapter_revision: 2
  model: null
  scopes: [project]
  platform: macOS
  configuration: Home/project tạm; mô tả permissions/config thực tế
contract: Tạo product brief đúng yêu cầu
cases:
  - id: behavior-happy-path
    stage: behavior
    required: true
    procedure: Fixture, prompt chính xác và cách chạy
    expected: Product brief đúng nội dung và format
    observed: Chưa chạy
    outcome: not-run
    evidence: []
limitations: []
```

Thêm required cases cho cả bốn stages và boundary trước test. Lượt đã chạy có
checked_at ISO/timezone, binary version, model, scopes và config thật. Outcome
`passed`, `failed`, `blocked` cần observed và evidence; `not-run` không được cite.
Evidence entry có `path: evidence/<kind>/<id>/<harness>/latest.json` (tương đối từ
`verification/stuff/`) và `sha256` của artifact sau redaction. File phải có nội
dung, đúng asset/harness, không symlink. Artifact giữ procedure/command, input,
output/tác động và đối chiếu đủ tái hiện; loại auth/token/dữ liệu nhạy cảm.

## Kết quả và freshness

Không có field status tự ghi Passed; kết quả suy từ cases:

| Kết quả | Điều kiện |
|---|---|
| Not tested | Chưa hồ sơ hoặc chưa case nào chạy |
| Failed | Có failure, kể cả optional |
| Blocked | Không failure, có blocker |
| Partial | Thiếu required stage hoặc còn required case chưa chạy |
| Passed | Có required case mỗi stage, mọi required đạt, không failure/blocker |

Passed cần version/model/evidence hợp lệ và mapping không unsupported. Limited
có thể test theo contract đã đồng ý nhưng phải ghi giới hạn, không gọi prompt là
enforcement. Stale khi core/implementation fingerprints hoặc adapter revision lệch.
Fingerprint bao gồm content/resources/dependencies, core docs/code, adapter,
installer/CLI và lockfile; không phát hiện harness/model bên ngoài tự cập nhật.

Mỗi lượt thay toàn bộ latest hồ sơ/evidence, kể cả Failed/Blocked; không ghép pass
cũ, case chưa chạy ghi not-run. Dọn evidence hết tham chiếu; lịch sử ở Git. Di chuyển
file không làm mới timestamp/hash/kết quả. Thay đổi môi trường cần test lại trước
claim áp dụng; gate không tự kiểm môi trường bên ngoài.
