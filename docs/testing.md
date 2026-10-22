# Kiểm thử repo và owner testing

Dành cho contributors và coding agents. Đây là nguồn quy tắc testing: repo tự
động kiểm code và output cài đặt; owner đánh giá việc dùng skill/agent/command
trong harness thật. Test/render thành công không chứng minh model sẽ luôn làm
đúng instructions.

## Automated repository checks

Chọn harness/scopes bị ảnh hưởng và kiểm đúng phần deterministic của thay đổi:

| Phần | Cần kiểm |
|---|---|
| core | Schema/defaults/errors, references, resources và constraints |
| adapter | Native filenames/content/configuration, policy mapping và supported/limited/unsupported |
| installer/CLI | Cài đúng file/đường dẫn ở project/global; preview, repeat install, update/uninstall, conflicts và recovery |
| scripts/code | Hành vi deterministic của code thực thi, kể cả code đi kèm stuff khi cần |

Filesystem tests dùng home/project tạm, không personal config. Kiểm instructions
và resources được giữ đúng, metadata/permissions được render đúng, trạng thái cài
đặt chính xác và file của user được bảo toàn. Test cả mapping được hỗ trợ và bị
chặn; một tool allowlist được render đúng chưa phải chứng minh runtime enforcement.

Không xây test suite mô phỏng từng dòng instructions, mọi prompt/response hoặc
mọi tình huống của từng skill/agent/command. Test code trực tiếp khi cần bảo đảm
deterministic; kiểm Git semantics dùng trong một workflow không đồng nghĩa kiểm
model có chọn đúng lệnh đó. Discovery/config inspection không gọi model có thể
dùng để kiểm integration, không phải yêu cầu cho mọi content change.

## Owner workflow testing

Owner dùng output đã cài để đánh giá workflow có hữu ích và làm theo cách mong
muốn đủ tốt hay không. Model behavior không được bảo đảm 100%; không yêu cầu ma
trận runtime cases hoặc model runs cho mọi asset/harness trước khi hoàn tất hay
commit. Coding agent chỉ thêm hoặc chạy model-behavior tests khi user yêu cầu rõ.

Chỉ nói **owner-tested** khi owner xác nhận đã thử, không suy từ approval, file
đúng format hay automated tests passed. Báo riêng kết quả repository checks và
owner testing; thiếu owner test là chưa thử, không phải implementation failure.
Khi owner yêu cầu lưu xác nhận, ghi asset, harness/scope được xác nhận và giới hạn
đã biết; không suy rộng sang target khác hoặc coi đó là exhaustive verification.
Ledger và cách ghi nhận ở [owner-testing records](../tool/docs/verification.md).

## Checks từ checkout

```bash
npm test
npm run typecheck
npm run cli -- validate --source .
```

`npm test` build, chạy repository tests, check generated fields và owner-record
integrity/summary; không chạy model và không yêu cầu mọi stuff đã được owner thử.
Format và fingerprints ở [owner-testing records](../tool/docs/verification.md); trạng thái ở
[summary](../verification/README.md), khả năng mapping ở
[compatibility](../adapters/docs/compatibility.md).

## Activation/discovery smoke (opt-in)

Runner hiện có để chẩn đoán integration khi cần; không phải completion checklist
cho từng stuff. Chỉ dùng `--run-models` khi user yêu cầu model testing.

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

## Records và evidence

Owner confirmations được ghi khi owner yêu cầu, theo format đã dẫn ở trên;
không có formal four-stage gate. Không tạo hồ sơ hoặc chạy model để làm đầy bảng.
Giữ evidence adapter/refactor còn giá trị tại `verification/`, output tạm ở ngoài
Git. Không giữ secrets/log thô; cập nhật records/summary cần documentation approval.
Docs/tooling-only changes chạy checks phù hợp, không chạy model chỉ để xác nhận
sửa tài liệu.
