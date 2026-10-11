# Kiểm thử xuyên module và runtime

Dành cho người kiểm tra core → adapter → installer → harness. Test/render thành
công không chứng minh workflow chạy đúng. Contract/validation thuộc core, mapping
thuộc adapter, lifecycle/conflict/recovery thuộc tool; fixture và expected output
ở tests, kết quả cần lưu ở verification, output tạm ở thư mục tạm ngoài Git.

## Chọn phạm vi

Trước khi phát triển stuff, chốt asset/harness/scope và contract cần kiểm chứng.
Lập required scenarios: input đủ, thiếu/sai, ngoài phạm vi và allowed/denied
boundary. Không giảm required cases sau failure để lấy Passed. Global/project
chỉ được claim khi bằng chứng bao phủ cả hai; ghi model/config và giới hạn quan sát.

| Stage | Cần chứng minh |
|---|---|
| core | Schema, references/resources và nội dung hợp lệ; validate/test semantics |
| render-install | Native output đúng, resources/config đủ, cài qua shared installer |
| discovery | Harness thật tìm/nạp đúng asset; không có API thì ghi quan sát model |
| behavior | Workflow thật với input/prompt cụ thể; đối chiếu output/tác động |

Với permissions thử cả thao tác được phép và bị cấm. Skill commit cần test
approval/refusal và kiểm lịch sử Git thật; activation probe không thay thế test này.
Dùng home/project tạm, không personal config. Một model run không bảo đảm mọi prompt.

## Checks từ checkout

```bash
npm test
npm run typecheck
npm run cli -- validate --source .
```

`npm test` build, chạy implementation tests, check generated fields và verification
integrity/summary; không chạy model và không yêu cầu mọi stuff Passed. Runtime
discovery/behavior là bước riêng. Cách ghi hồ sơ, format, fingerprints và gate ở
[verification tooling](../tool/docs/verification.md); trạng thái ở
[summary](../verification/README.md), khả năng mapping ở
[compatibility](../adapters/docs/compatibility.md).

## Activation/discovery smoke

`scripts/check-activation.mjs` tạo core probe tạm chỉ trả marker ngẫu nhiên, render
qua adapter và cài bằng installer. Mỗi scope chạy explicit invocation,
implicit request với explicit activation, matching-request đối chứng trong các
model session độc lập. Marker không nằm trong request; không sửa catalog thật.

```bash
npm run build
# Discovery, không gọi model; binary thiếu được báo skip
node scripts/check-activation.mjs --harness all --scope both \
  --output /tmp/agent-stuff-discovery.json
# Model smoke: 6 requests cho một harness ở cả hai scopes
node scripts/check-activation.mjs --harness codex --run-models \
  --auth-file /path/to/codex/auth.json --output /tmp/codex-activation.json
node scripts/check-activation.mjs --harness opencode --run-models \
  --model provider/model --auth-file /path/to/opencode/auth.json \
  --output /tmp/opencode-activation.json
node scripts/check-activation.mjs --harness claude-code --run-models \
  --output /tmp/claude-activation.json
```

- `--scope project|global|both` default both; `--binary`/`--model` chọn target;
  `--timeout-ms` default 120000 mỗi process. Binary/model/auth-file yêu cầu một harness.
- Auth-file đúng native format chỉ copy khi model run. OPENAI_API_KEY,
  ANTHROPIC_API_KEY, CLAUDE_CODE_OAUTH_TOKEN được kế thừa; personal provider/plugin
  config và discovery injections không copy. Subscription Claude có thể dùng
  `claude setup-token`; không gửi token/auth file cùng report.
- Runner xóa contexts; không lưu auth/raw stderr. Report giữ category lỗi.
  Credential/model được nhận không chứng minh còn quota inference.
- Codex discovery dùng app-server skills/list, có version không trả policy;
  null không chứng minh thiếu enforcement. Model dùng exec read-only/ephemeral.
- OpenCode dùng pure, debug skill, chỉ mở skill tool; explicit là request load
  tool, không phải slash entry V1. Runner đặt cwd/PWD vào project tạm (1.18.33
  dùng PWD) và print-logs để phân loại lỗi trong bộ nhớ.
- Claude dùng print/stream-json, không lưu session, mở/pre-approve Skill và deny
  MCP. Không dùng bare vì bỏ discovery. Đường model này chưa có evidence tại
  môi trường từng thiếu CLI; chạy runner không tự chứng minh workflow thật.

Exit 0: requested cases hoàn thành, không lỗi phát hiện; 1: setup/discovery hoặc
activation vi phạm mapping supported; 2: thiếu binary/model/runtime hoặc control
chưa quan sát được. OpenCode limited có thể auto-load mà không bị coi regression.
Đọc verdict với control; không-load một lần không chứng minh enforcement.

Nguồn runner: [Codex app-server](https://learn.chatgpt.com/docs/app-server),
[Claude headless](https://code.claude.com/docs/en/headless),
[Claude CLI](https://code.claude.com/docs/en/cli-reference).

## Lưu evidence và hoàn tất

Giữ artifact đủ đánh giá/tái hiện: stuff tại `verification/stuff/`, probe mapping
tại `verification/adapters/`, checks xuyên module tại `verification/system/` khi
cần. Không giữ log thô hoặc viết nhật ký plan đã hoàn thành. Lượt mới phải lưu cả
failure/blocker và generate summary; lịch sử ở Git, không làm mới fingerprint cũ.

Chỉ claim verified sau gate `validate --require-passed` cho mỗi target đã chọn.
Missing/partial/failed/blocked/stale còn incomplete; báo implementation và phần
chưa kiểm chứng riêng. Docs/tooling-only changes chạy checks phù hợp, không tạo
hồ sơ workflow giả hoặc chạy model chỉ để xác nhận di chuyển tài liệu.
