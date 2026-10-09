# Kiểm chứng và bằng chứng

Một stuff chỉ hoàn tất kiểm chứng trên target đã chọn khi có lượt test thực tế
đạt scenario bắt buộc và hồ sơ khớp source hiện tại. Viết xong, validate hoặc
render thành công không đủ để kết luận workflow chạy đúng.

## Chọn phạm vi trước khi triển khai

Ghi rõ stuff, harness, scope và contract cần kiểm chứng. Lập scenario trước khi
test: input đầy đủ, thiếu/sai, ngoài phạm vi và các ràng buộc được phép/bị cấm
liên quan. Không giảm scenario bắt buộc sau khi thấy lỗi chỉ để lấy Passed.

Mỗi target cần bốn tầng bắt buộc:

| Stage trong hồ sơ | Bằng chứng cần có |
|---|---|
| `core` | Schema, reference/resource và nội dung hợp lệ; `validate` và test ngữ nghĩa khi đổi implementation |
| `render-install` | Output native đúng và cài qua installer trong context tạm; kiểm tra resources/config liên quan |
| `discovery` | Harness thật tìm/nạp đúng asset vừa cài; nếu không có API riêng, ghi quan sát từ phiên model |
| `behavior` | Chạy workflow thật với prompt/input cụ thể; so sánh kết quả và tác động thực tế với kỳ vọng |

Nếu tuyên bố kiểm chứng cả global/project, các scenario và bằng chứng phải bao
phủ cả hai scope. Với model behavior, ghi model, cấu hình và giới hạn của quan
sát; một lần đạt không chứng minh mọi prompt sẽ đạt. Với permission, thử cả
thao tác được phép và bị cấm. Chỉ dùng home/project tạm, không dùng personal config.

Ví dụ skill hạn chế commit: ngoài kiểm tra activation, phải thử request chưa
cho phép và request cho phép rõ ràng, ghi prompt và kiểm tra lịch sử Git thực
tế. Test probe activation chung không thay thế test skill này.

## Hồ sơ nguồn và bảng tổng hợp

Hồ sơ gần nhất nằm ở
`docs/verification/<kind>/<id>/<harness>.yaml`. Mỗi stuff/harness có một hồ sơ,
bao gồm các scope/scenario được chọn. Bằng chứng nằm dưới
`docs/verification/evidence/<kind>/<id>/<harness>/`.

[Bảng tổng hợp](verification/README.md) được sinh từ hồ sơ và catalog, gồm cả
target chưa có hồ sơ và mapping unsupported. Không sửa bảng bằng tay.
[Compatibility](compatibility.md) giữ khả năng và bằng chứng của adapter;
hồ sơ này giữ kết quả từng stuff. Bằng chứng cũ thiếu model, phiên bản hoặc
scenario không được tự nâng thành Passed.

Trạng thái được tính từ các case, không có field `status` để tự ghi Passed:

| Kết quả | Điều kiện |
|---|---|
| Not tested | Chưa có hồ sơ hoặc chưa case nào được chạy |
| Failed | Có case thất bại, kể cả case optional |
| Blocked | Không có failure nhưng có case bị chặn bởi auth, quota, thiếu binary hoặc điều kiện khác |
| Partial | Đã chạy một phần, thiếu stage bắt buộc hoặc còn case required chưa chạy |
| Passed | Mỗi stage có case required và tất cả case required đạt; không có failure/blocker |

Passed còn yêu cầu harness version, model và evidence hợp lệ, và mapping không
unsupported. Mapping limited có thể được kiểm chứng theo contract đã thống nhất,
nhưng giới hạn phải hiện trong hồ sơ; không gọi prompt guard là enforcement.

`Stale` là dấu riêng khi fingerprint core/implementation hoặc adapter revision
không còn khớp. Passed (Stale) không đạt điều kiện hoàn tất hiện tại. Fingerprint
bao gồm definition, instructions, resources, workflow/helper dependencies,
adapter và code chung schema/loader/render/installer/CLI cùng lockfile. Nó không
phát hiện harness/model bên ngoài tự cập nhật; khi môi trường đích đổi, phải chạy
lại và ghi version/config mới trước khi tuyên bố áp dụng cho môi trường đó.

## Lệnh

Build trước khi chạy tooling từ checkout:

Fingerprint cần checkout đầy đủ, gồm source adapter và tool. Khi gọi từ nơi
khác, truyền `--source /path/to/checkout`; package phân phối có bảng/evidence
để xem, không chứa toàn bộ source TypeScript để tự tính baseline trong package.

```bash
npm run build
npm run cli -- validate --source .
npm run verification -- fingerprint --asset skill/bdv-api-handoff --harness codex
npm run verification -- validate
npm run verification -- report
npm run verification -- report --check
```

`fingerprint` in hai hash để ghi vào hồ sơ. Capture fingerprint trước lượt test;
nếu source thay đổi trong lúc test, chạy lại, không cập nhật hash để che lượt cũ.
`validate` kiểm tra schema, identity, evidence paths/hash và điều kiện kết quả,
không tự chạy harness hay chứng minh nội dung bằng chứng là đúng sự thật.
`report` cập nhật bảng; `--check` báo lỗi nếu bảng lệch hồ sơ/catalog.

Gate cho target cụ thể:

```bash
npm run verification -- validate --require-passed \
  --asset skill/bdv-api-handoff --harness codex
```

Gate trả lỗi nếu thiếu hồ sơ, chưa Passed hoặc Stale. `npm test` chạy build,
implementation tests, validate hồ sơ và kiểm tra bảng; nó không đòi mọi stuff
đều Passed. Khi phát triển/sửa stuff, chạy gate cho từng target đã cam kết.

## Format YAML

Schema nghiêm ngặt nằm ở `tool/src/verification/index.ts`. Ví dụ dưới đây là
một hồ sơ lập kế hoạch, chưa test. Thay hai placeholder bằng fingerprint thật;
thêm case required cho các tầng và hành vi cần thử trước khi chạy.

```yaml
schema_version: 1
asset: skill/bdv-api-handoff
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
  configuration: Home/project tạm; mô tả config và permissions cụ thể khi chạy
contract: Tạo handoff API với route, auth, request/response và bằng chứng code
cases:
  - id: behavior-happy-path
    stage: behavior
    required: true
    procedure: Mô tả fixture, prompt chính xác và cách chạy trong harness
    expected: Handoff đúng implementation và đúng format
    observed: Chưa chạy
    outcome: not-run
    evidence: []
limitations: []
```

Sau lượt thử, ghi `checked_at` là timestamp ISO có timezone, phiên bản binary,
model và config thực tế. Mỗi case đã chạy (`passed`, `failed`, `blocked`) cần
`observed` cụ thể và evidence:

```yaml
evidence:
  - path: evidence/skill/bdv-api-handoff/codex/latest.md
    sha256: <SHA-256 của artifact>
```

Artifact chứa lệnh/quy trình, input/prompt, output/tác động liên quan và kết quả
đối chiếu. Có thể dùng Markdown, JSON hoặc assertion output. Không chỉ ghi
“passed”; giữ thông tin đủ tái hiện, loại auth/token và dữ liệu nhạy cảm trước
khi lưu/đóng gói. Hash được tính sau redaction; ví dụ `shasum -a 256 <artifact>`.
Evidence phải là file có nội dung trong thư mục đúng stuff/harness, không symlink.

## Lưu lượt gần nhất và báo hoàn thành

Mỗi lượt mới thay toàn bộ hồ sơ gần nhất và evidence tương ứng, kể cả Failed
hoặc Blocked. Không ghép case đạt từ lượt cũ vào lượt mới; case chưa chạy ở lượt
mới ghi `not-run`. Dọn evidence cũ không còn được tham chiếu; lịch sử lưu trong Git.
Không sửa timestamp/fingerprint của lượt cũ để biến nó thành mới.

Chỉ báo hoàn tất kiểm chứng sau khi gate Passed hiện tại đạt trên các target
đã chọn. Khi bị chặn, vẫn lưu evidence lỗi đã loại thông tin nhạy cảm và báo
phần đã triển khai, phần chưa test cùng blocker. Khi chỉ sửa docs/tooling, chạy
check phù hợp, không tạo hồ sơ workflow giả để làm bảng xanh.
