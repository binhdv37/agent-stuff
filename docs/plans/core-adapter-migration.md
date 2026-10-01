# Kế hoạch chuyển sang core và adapter

Trạng thái ngày 2026-09-30: phần triển khai migration đã hoàn thành, với 16 asset,
ba adapter và CLI install/update/uninstall/recover. Bộ 26 test đã qua. OpenCode
đã nạp agent và permission; Codex đã phát hiện skill; người dùng xác nhận thử
Claude Code thành công. Các kiểm tra bổ sung và việc phát hành nằm ở mục 10.
Xem [hướng dẫn hiện hành](../adapter-development.md),
[compatibility](../compatibility.md) và [migration notes](../migration.md).

Mục 1–7 là kế hoạch thiết kế ban đầu; tài liệu hiện hành ở trên ghi lại những
quyết định và giới hạn của bản triển khai thực tế. Mục 8–10 là snapshot tiến độ
ngày 2026-09-30, không phải checklist đang được duy trì. `[x]` là đã hoàn thành,
`[ ]` là chưa hoàn thành tại mốc đó. Bằng chứng mới được ghi trong compatibility.
Quyết định ban đầu về việc giữ `prompts/` đã được thay đổi: thư mục này đã xóa;
`skills/`, `claude/` và `opencode/` cũ cũng đã xóa sau khi xác nhận rỗng.

## 1. Mục tiêu và phạm vi

Core là nguồn chính thức cho nội dung skill, agent, command và resource. Nội dung
được viết bằng Markdown cùng metadata YAML độc lập với harness. Adapter chuyển
core thành định dạng và cấu trúc thư mục của từng công cụ. Installer cho phép chọn
harness, global/project và các thành phần cần cài.

Các quyết định đã thống nhất:

- Dùng TypeScript cho CLI, YAML + Markdown cho core.
- Hướng tới OpenCode, Codex và Claude Code; triển khai OpenCode trước.
- Không duy trì tương thích với `npx skills add`.
- Hỗ trợ xem trước, phát hiện xung đột và theo dõi file đã cài.
- Giữ `prompts/` là nội dung cá nhân, không đưa vào gói cài.

Phiên bản đầu không cần hệ thống plugin adapter bên ngoài, DSL thực thi workflow,
hay cơ chế tự động theo dõi và đồng bộ file. Các loại nội dung mới được thêm qua
schema và adapter khi có nhu cầu thực tế.

## 2. Kết quả khảo sát repo

| Nguồn hiện tại | Nội dung | Yêu cầu khi chuyển đổi |
|---|---|---|
| `skills/` | 11 skill | Bảo toàn hướng dẫn và chính sách kích hoạt |
| `skills/*/agents/openai.yaml` | 9 file cấu hình Codex | Sinh từ metadata core qua adapter |
| `skills/bdv-api-handoff/references/` | Template handoff | Giữ tham chiếu tương đối hoạt động |
| `skills/bdv-product-brief/assets/` | Template product brief | Sao chép cùng skill |
| `skills/bdv-teach/*-FORMAT.md` | 4 tài liệu định dạng tại gốc skill | Resource phải hỗ trợ cả file ở gốc |
| `opencode/agents/` | 2 agent có `mode: primary` | Không tự chuyển vai trò thành subagent |
| `opencode/commands/` | 2 command | Dùng chung nội dung với skill tương ứng |
| `install.sh` | Menu, tải tarball nhánh main, copy file | Thay logic bằng CLI sau khi CLI đủ chức năng |

Các điểm cần bảo toàn hoặc sửa có chủ đích:

- 9 skill explicit-only; `bdv-grill-me` và `bdv-smart-commit` cho phép kích hoạt
  từ yêu cầu phù hợp. Migration giữ nguyên lựa chọn này.
- `bdv-handoff` có `argument-hint`; handoff và teach có tên hiển thị cùng mô tả
  ngắn trong cấu hình Codex. Schema cần giữ được thông tin này.
- Skill và command change-report/explain-code gần giống nhau nhưng không hoàn
  toàn giống. Hợp nhất sau khi so sánh phần chỉ dẫn, cách truyền target và đầu ra.
- `solution-architect.md` dùng `permission`, còn `experimental-plan.md` dùng
  `permissions`. Không lấy một trong hai làm chuẩn chỉ vì số lượng file sử dụng.
- Experimental-plan có tên tool cụ thể và đường dẫn tuyệt đối
  `/.auragent/plans`. Đề xuất chuẩn hóa thành đường dẫn tương đối
  `.auragent/plans/` dưới project; ghi nhận đây là thay đổi hành vi có chủ đích.
- Installer hiện thay thế nguyên thư mục skill cùng tên; chưa có manifest để
  nhận biết chỉnh sửa tại nơi cài.

Các nhận xét trên dựa trên file trong repo. Định dạng và khả năng thực thi của
harness hiện hành chưa được kiểm chứng trong bước khảo sát này; mục 6 là cổng
kiểm chứng bắt buộc trước khi hoàn thành adapter.

## 3. Cấu trúc đích

```text
core/
  skills/<id>/
    definition.yaml
    instructions.md
    references/                 # nếu có
    assets/                     # nếu có
    *-FORMAT.md                 # giữ đường dẫn resource hiện có
  agents/<id>/
    definition.yaml
    instructions.md
  commands/<id>/
    definition.yaml
adapters/
  opencode/
  codex/
  claude-code/
tool/src/
  cli/
  core/                         # load, validate, resolve
  adapters/                     # interface và registry
  installation/                 # plan, manifest, apply, recovery
  sources/                      # checkout và nguồn release
tests/
  fixtures/
  snapshots/
docs/
  plans/
  compatibility.md
prompts/
package.json
tsconfig.json
install.sh                      # launcher khi chuyển đổi hoàn tất
```

Đầu ra build nằm trong `dist/`, được bỏ qua bởi Git. Trong giai đoạn chuyển đổi,
các thư mục cũ vẫn phục vụ installer cũ; chỉ xóa khi toàn bộ nội dung đã chuyển
và installer mới vượt qua kiểm tra. Không sửa song song hai nguồn nội dung.

## 4. Schema core phiên bản 1

Giữ ID hiện có, gồm prefix `bdv-` cho skill/command, để tránh đổi tên gọi của
người dùng. Khóa đầy đủ là `<kind>/<id>`, cho phép skill và command cùng ID.
Tên thư mục phải khớp ID. Đây là quy ước của bộ nội dung, không phụ thuộc harness.

Ví dụ skill:

```yaml
schema_version: 1
kind: skill
id: bdv-api-handoff
description: Prepare frontend integration documentation from backend code.
activation: explicit
instructions: instructions.md
resources:
  - references/handoff-template.md
```

Trường chung: `schema_version`, `kind`, `id`, `description`. Skill và agent có
`instructions`; `resources` là danh sách file tương đối được xuất cùng nội dung.
Metadata hiển thị tùy chọn: `display_name`, `short_description`. Skill có
`activation: explicit | matching-request`, mặc định explicit. `argument_hint`
là tùy chọn cho skill/command; phiên bản đầu nhận một chuỗi đối số tự do, chưa
cần parser tham số có cấu trúc.

Không đưa `disable-model-invocation`, `allow_implicit_invocation`, tên model,
tool API, đường dẫn cài hay tên harness vào schema core. Adapter sinh các trường
tương ứng. Giữ mô tả về yêu cầu gọi chủ động trong nội dung xuất, cùng native
config khi harness hỗ trợ; báo rõ nếu chỉ có mức hướng dẫn bằng văn bản.

Ví dụ command dùng lại workflow:

```yaml
schema_version: 1
kind: command
id: bdv-change-report
description: Summarize recent code changes.
workflow: skill/bdv-change-report
argument_hint: Optional files or scope
```

Command v1 chỉ tham chiếu skill, không tham chiếu command khác. Resolver đọc
workflow và resources; adapter tạo wrapper truyền đối số theo cú pháp native.
Wrapper nằm ở adapter, không nhúng `$ARGUMENTS` vào core. Nếu xuất command cùng
skill, phải phát hiện va chạm tên/đường dẫn hoặc điểm gọi trùng trước khi ghi.

Agent có `role: primary | delegated` và policy trung lập. Policy ban đầu chỉ mô
tả các nhu cầu hiện có: đọc workspace, ghi file, chạy shell, hỏi người dùng và
ủy nhiệm agent khác. Cho phép `allow | ask | deny`; ghi file có thêm danh sách
phạm vi cho phép, tính tương đối với project root. Quy tắc core: mặc định deny,
ngoại lệ cụ thể có thể mở quyền trong phạm vi đã khai báo. Adapter phải ánh xạ
ngữ nghĩa này sang thứ tự luật của harness, không sao chép máy móc.

Giới hạn ghi file phải xét cả đường shell và các công cụ có thể ghi; cấm editor
nhưng mở shell tùy ý không đáp ứng chính sách chỉ đọc. Nếu không thể bảo đảm
policy hoặc vai trò primary, đánh dấu agent không tương thích và chặn cài agent
đó. Không hạ thành prompt thông thường để tạo cảm giác đã hỗ trợ.

Validator từ chối schema version lạ, trường không biết, ID trùng trong cùng
kind, tham chiếu thiếu, resource thiếu, đường dẫn tuyệt đối hoặc thoát khỏi
asset, symlink không an toàn và đường dẫn đầu ra va chạm. Core không thực thi
script cài đặt. Markdown được giữ nguyên, không dùng template engine tổng quát.

## 5. Pipeline và hợp đồng adapter

```text
Load → Validate → Resolve → Check compatibility → Render → Plan → Apply
```

Adapter có tên, phiên bản contract, ma trận hỗ trợ và ba trách nhiệm:

1. Kiểm tra compatibility của asset với target.
2. Sinh file trong bộ nhớ, kèm asset sở hữu, root logic và đường dẫn tương đối.
3. Giải quyết root logic thành đường dẫn global/project từ context được truyền.

Adapter không tự tải mạng, ghi file hoặc hỏi người dùng. Installer dùng chung
xử lý các tác vụ đó. Build không cần đọc cấu hình cá nhân của người đang chạy.

Mỗi asset có kết quả `supported`, `limited` hoặc `unsupported`, kèm lý do và
cách biểu diễn sẽ dùng. `limited` áp dụng cho khác biệt hiển thị hoặc hướng dẫn
không được native enforcement hỗ trợ; không được dùng cho việc mất policy quyền
bắt buộc. Interactive hiển thị và cho chọn bỏ asset không tương thích.
Non-interactive thất bại nếu selection có asset unsupported; trường hợp limited
cần lựa chọn rõ ràng như `--accept-limitations`. Không âm thầm bỏ file.

## 6. Kiểm chứng harness trước khi chốt adapter

OpenCode là luồng đầu tiên; Codex và Claude Code theo sau. Mỗi adapter phải ghi
trong `docs/compatibility.md`: phiên bản đã kiểm tra, nguồn tài liệu chính thức,
ngày kiểm tra, loại nội dung hỗ trợ, phạm vi cài và giới hạn.

Các câu hỏi kỹ thuật cần giải quyết bằng tài liệu chính thức và thử nghiệm:

- Tên thư mục discovery, định dạng frontmatter/config và global/project.
- Trường permission chính xác, thứ tự ưu tiên luật và quy tắc đường dẫn.
- Cách kiểm soát implicit invocation thực tế, nhất là với OpenCode.
- Skill có tự xuất hiện như command hay không; tránh sinh hai điểm gọi trùng.
- Harness có biểu diễn agent primary và policy cần thiết hay không.
- Cách nạp resource, truyền chuỗi đối số và reload nội dung mới.

Mục tiêu tối thiểu: ba adapter phục vụ skill; OpenCode phục vụ thêm command và
agent nếu đáp ứng ngữ nghĩa đã kiểm chứng. Khả năng tương ứng trên hai harness
còn lại được quyết định theo bằng chứng, không suy từ OpenCode. Trường hợp chưa
đáp ứng phải được báo trong CLI và tài liệu; không quảng bá hỗ trợ mọi asset.

## 7. CLI và hành vi cài đặt

```bash
agent-stuff list
agent-stuff validate --source .
agent-stuff build --agent opencode --source . --out ./dist/opencode
agent-stuff install
agent-stuff install --agent opencode --scope project --project . --source .
agent-stuff install --agent codex --scope global --only skill/bdv-api-handoff --dry-run
agent-stuff update --agent opencode --scope project --project . --dry-run
agent-stuff uninstall --agent opencode --scope project --project . --dry-run
```

Đây là giao diện dự kiến, chưa phải các lệnh đang chạy được trong repo.

Interactive: chọn harness → scope → assets → compatibility và thay đổi → áp
dụng. Non-interactive yêu cầu đủ tham số, không treo chờ terminal. `--yes` bỏ
bước xác nhận thông thường, không tự giải quyết xung đột hay bỏ policy.
`--source .` luôn dùng checkout tại đường dẫn đó, kể cả nội dung chưa commit;
nguồn và thư mục project đích là hai khái niệm riêng biệt.

Plan phân loại `create`, `update`, `unchanged`, `remove`, `conflict`. Dry-run
không tạo directory, manifest, backup hay file trong target. Cài lại cùng nội
dung là no-op. `--only` chỉ thay đổi selection được yêu cầu, không gỡ các asset
khác đã cài. Update xử lý selection đã theo dõi; remove áp dụng cho file cũ của
asset đang cập nhật hoặc asset được yêu cầu gỡ.

Manifest đặt ở `<project>/.agent-stuff/installations/<harness>.json` cho project
và `~/.agent-stuff/installations/<harness>.json` cho global. Lưu schema version,
source revision/content digest, phiên bản CLI/adapter, selection, target roots,
asset owner, đường dẫn tương đối và SHA-256 của từng file đã ghi.

Quy tắc file:

- File chưa được theo dõi mà đã tồn tại là conflict, kể cả trùng tên asset.
- File đã theo dõi nhưng khác hash lần cài trước là conflict.
- File cần gỡ chỉ được gỡ tự động nếu hash còn khớp; giữ nguyên file người dùng
  thêm trong thư mục asset. Không xóa đệ quy cả thư mục theo tên.
- Hiển thị lựa chọn giữ/bỏ asset hoặc thay thế có backup; chế độ tự động mặc định
  dừng trước khi ghi nếu có conflict. Không có ghi đè mặc định.
- Kiểm tra lại hash ngay trước apply, khóa theo installation, ghi file qua file
  tạm và rename, cập nhật manifest cuối cùng. Lưu journal/backup để khôi phục
  nếu một bước thất bại; lần chạy sau phát hiện transaction dở dang.
- Kiểm tra đường dẫn thoát root và symlink trước ghi/xóa. Không dựa vào manifest
  như nguồn đáng tin tuyệt đối để quyết định đường dẫn được phép xóa.

Bản đầu hỗ trợ cài từ checkout và nội dung đi kèm bản phát hành. Khi thêm tải
release/tag/commit, phân giải và ghi lại revision cụ thể; không ghi nhận riêng
`main` như định danh phiên bản. Gói phát hành gồm CLI đã build, core và adapter
cùng phiên bản. `install.sh` là launcher kiểm tra runtime và gọi CLI của gói đó.
Chưa cần phát hành npm để chạy luồng phát triển hoặc bản đầu.

## 8. Tiến độ triển khai

### Giai đoạn A — Nền tảng và fixture

- [x] Thêm `package.json`, lockfile, TypeScript config, script build/typecheck/test.
- [x] Dùng Node test runner; khóa thư viện YAML/schema bằng lockfile.
- [x] Tạo loader, validator, resolver, contract adapter và compatibility report.
- [x] Dùng fixture đại diện: brainstorm-first, api-handoff, handoff, teach,
  solution-architect và change-report cùng command.
- [x] Chốt policy agent và xác nhận rule được OpenCode nạp; thay đổi có chủ đích
  được ghi trong migration notes.

Đã hoàn thành. Loader/schema và nội dung fixture được kiểm tra trong
`tests/core-adapter.test.ts`; byte skill/resource được bảo toàn qua migration.

### Giai đoạn B — Một luồng OpenCode hoàn chỉnh

- [x] Implement render, target resolution, build, plan và dry-run.
- [x] Thêm manifest và apply với xử lý conflict.
- [x] Cài fixture vào project tạm; kiểm tra discovery skill/command và rule agent
  trên OpenCode; ghi rõ phần chưa kiểm chứng trong compatibility.

Đã hoàn thành phần triển khai và discovery. Preview, cài lại no-op, resource và
permission được kiểm tra; phiên model thực thi workflow vẫn là mục riêng ở mục 10.

### Giai đoạn C — Vòng đời cài đặt và hai adapter còn lại

- [x] Hoàn thiện update, uninstall, backup, journal, recovery và khóa cài đặt.
- [x] Thêm Codex/Claude Code qua cùng contract; kiểm tra render/install và hai
  scope bằng filesystem tạm. Codex app-server nhận skill; Claude Code được
  người dùng thử runtime thành công.
- [x] Thêm menu selection, xử lý non-interactive và thông báo compatibility.

Đã hoàn thành. Filesystem tests kiểm tra cả global/project cho ba adapter,
bảo toàn chỉnh sửa của người dùng và kiểm tra recovery sau SIGKILL.

### Giai đoạn D — Chuyển toàn bộ nội dung và thay installer

- [x] Chuyển 11 skill, 2 agent, 2 command sang core; bảo toàn tên và resource.
- [x] Thêm helper `bdv-plan-reviewer`; hiện có 16 asset, chọn planner tự kèm helper.
- [x] Hợp nhất nội dung command/skill và ghi các khác biệt đã giải quyết.
- [x] Chuyển metadata Codex sang core; adapter sinh native config.
- [x] Chuẩn hóa planner path và diễn đạt tool theo khả năng; giữ ủy nhiệm chỉ đọc.
- [x] Cập nhật `README.md`, `AGENTS.md`, hướng dẫn authoring/adapter và compatibility;
  bỏ hướng dẫn `npx skills add`.
- [x] Thay `install.sh` bằng launcher build và chạy CLI từ checkout.
- [x] Cấu hình `npm pack` để build và đóng gói CLI/adapters/core.
- [x] Xóa nguồn cũ và `prompts/`; core là nguồn authoring duy nhất.

Đã hoàn thành migration nội dung và installer. Mỗi asset có kết quả hỗ trợ cụ
thể cho từng harness. Kiểm tra gói trước khi phát hành được giữ ở mục 10.

## 9. Kiểm tra đã hoàn thành

- [x] Bộ 26 test qua trong lần chạy gần nhất; TypeScript build nằm trong `npm test`.
- [x] `npm run cli -- validate --source .` xác nhận đủ 16 asset.

| Nhóm | Kiểm tra đã có | Bằng chứng |
|---|---|---|
| Schema | Version lạ, field sai, reference/resource thiếu, path không hợp lệ | `tests/core-adapter.test.ts` |
| Render | Nội dung và metadata, invocation flags, wrapper đối số, tên va chạm | `tests/core-adapter.test.ts`, `tests/lifecycle.test.ts` |
| Resource | File root của teach, template lồng thư mục, byte resource | `tests/core-adapter.test.ts`, `tests/migration.test.ts` |
| Policy | Scope ghi file, primary/delegated, helper chỉ đọc, unsupported | `tests/agent-policy.test.ts`, `tests/lifecycle.test.ts` |
| Scope | Global/project tách biệt cho ba adapter; source khác target | `tests/lifecycle.test.ts`, `tests/migration.test.ts` |
| Install | Dry-run không ghi, cài lại no-op, conflict trước apply | `tests/core-adapter.test.ts` |
| Update | Resource cũ biến mất, selection một phần, giữ file sửa cục bộ | `tests/core-adapter.test.ts`, `tests/lifecycle.test.ts` |
| Uninstall | Giữ file lạ và từ chối xóa file đã sửa | `tests/lifecycle.test.ts`, `tests/migration.test.ts` |
| Recovery | Rollback, SIGKILL, external edit, không chiếm lock đang hoạt động | `tests/lifecycle.test.ts` |
| Boundary | Path traversal, symlink, manifest hỏng | `tests/core-adapter.test.ts` |
| Migration | Đủ 16 asset; 9 explicit + 2 matching-request; hash skill/resource | `tests/migration.test.ts` |

Test filesystem dùng thư mục tạm và truyền home/project context riêng, không
ghi vào cấu hình cá nhân. Snapshot phục vụ review định dạng; assertion ngữ nghĩa
kiểm tra policy và hành vi installer. Smoke test trên harness thật là bước riêng,
không tuyên bố đã hoàn thành chỉ vì snapshot pass.

## 10. Kiểm tra runtime và việc tiếp theo

Đã hoàn thành:

- [x] OpenCode nhận skill/command và nạp đúng role/permission của hai primary
  agent cùng helper chỉ đọc.
- [x] Codex app-server phát hiện skill trong project tạm cùng metadata giao diện.
- [x] Claude Code runtime được người dùng thử thủ công thành công ngày 2026-09-30.
  Phạm vi bằng chứng được ghi trong `docs/compatibility.md`.

Việc tiếp theo được đề xuất:

- [ ] Kiểm tra lại gói phân phối trước phát hành: `npm pack` vào thư mục tạm,
  cài tgz trong npm prefix riêng và chạy CLI validate/list/install dry-run từ
  ngoài checkout. Ghi kết quả để xác nhận package tự đủ core và adapters.
- [ ] Kiểm tra launcher/project đích có đường dẫn chứa dấu cách.
- [ ] Nếu cần xác nhận hành vi model: chạy một workflow OpenCode/Codex trong
  project tạm; với planner, kiểm tra tạo plan và từ chối ghi ngoài plan directory.
- [ ] Nếu quyết định phát hành: review gói, viết release notes, rồi tạo tag/publish
  theo yêu cầu riêng của người dùng. Repo hiện chưa publish/tag.

Ngoài phạm vi bản đầu, chỉ triển khai khi có yêu cầu:

- Tải release/tag/commit tự động và tự cập nhật CLI. Hiện chọn source version
  bằng checkout Git hoặc gói npm pack local.
- Ánh xạ agent/command riêng cho Codex hoặc Claude Code khi có thể bảo toàn
  vai trò và permission; hiện CLI báo unsupported và người dùng dùng skill.
- Native enforcement cho explicit invocation trên OpenCode nếu harness hỗ trợ;
  adapter hiện báo limited và yêu cầu người dùng chấp nhận giới hạn.
