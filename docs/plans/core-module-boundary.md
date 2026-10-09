# Tách core thành module độc lập

Ngày: 2026-10-09. Trạng thái: hoàn thành cả 5 bước; giới hạn runtime được ghi riêng.

## Mục tiêu và phạm vi đã thống nhất

Giữ luồng core → adapter → installer, đồng thời làm core tự mô tả và có public
interface để consumer sử dụng như thư viện bên thứ ba. Giảm việc phải ghép nhiều
tài liệu với code để hiểu contract. Plan đã triển khai xong. Contract hiện tại nằm ở core/docs và API core;
tài liệu này giữ các quyết định, checklist và checkpoint của refactor.

Sáu quyết định đã chốt:

1. Core sở hữu concept, format file, schema, ý nghĩa/mặc định/ràng buộc field,
   catalog và logic đọc/validate. Core không phụ thuộc adapter hay installer.
2. Interface ban đầu có ba nhóm: `getContract()`, `getDocs(topic)` và
   `loadCatalog(source)`. Tên/signature cụ thể được hoàn thiện ở bước 1.
3. Kiểu, mặc định và mô tả field cùng nguồn; xuất schema/tài liệu tham chiếu từ
   nguồn đó. Markdown dành cho concept, ví dụ và tương tác phức tạp.
4. Adapter chỉ dùng public interface của core; khai báo phiên bản contract mình
   hiểu và từ chối phiên bản chưa hỗ trợ trước khi render.
5. Giữ `supported | limited | unsupported`, bổ sung giải thích field bị ảnh
   hưởng, nguyên nhân và hệ quả. Limited cần người dùng chấp nhận; yêu cầu bắt
   buộc không thể bảo toàn thì chặn. Tương thích và kiểm chứng runtime là riêng.
6. Tách module trong cùng repo trước. Giữ nội dung, ID, YAML schema v1 và ngữ
   nghĩa stuff hiện có. Chưa publish package, tách repo hoặc đổi native mapping.

## Hiện trạng trước refactor (baseline)

- `core/` có 11 skills, 3 agents, 2 commands; chứa nội dung nhưng chưa có API.
- `tool/src/core/schema.ts` giữ Zod schema strict và các type `Definition`, `Asset`.
- `tool/src/core/load.ts` đọc catalog, validate quan hệ và chọn dependency agent.
- `tool/src/core/paths.ts` bảo vệ đường dẫn tài nguyên.
- `tool/src/adapter.ts` định nghĩa `check`/`render` và compatibility tổng thể.
- Adapter import interface và helper từ `tool/src/adapter.ts`, `tool/src/render.ts`.
- Ý nghĩa core nằm rải trong concepts, core-development, adapter-development
   và code. Chưa có contract API hay báo cáo compatibility theo field.
- Build/pack/verification đang giả định đường dẫn source cũ, cần cập nhật khi di chuyển.
- Git sạch trước khi viết plan. Chỉ thêm tài liệu plan trong lượt này.

## Các bước triển khai

### 1. Chốt public contract tối thiểu trên code hiện có

- [x] Lập danh sách field từng kind, mặc định, ngữ nghĩa và ràng buộc kết hợp.
- [x] Phân biệt metadata hiển thị, hướng dẫn hành vi và ràng buộc bắt buộc.
      Không coi toàn bộ field hành vi là có thể bỏ qua theo best effort.
- [x] Xác định kết quả API, type public, lỗi validation và nguồn mặc định.
      Core loader nhận đường dẫn core root; CLI giữ tương thích `--source`
      checkout bằng cách resolve tại biên gọi, không buộc thư viện cần repo CLI.
- [x] Chọn version contract API riêng với `schema_version` của YAML và revision
      adapter. Ban đầu kiểm tra phiên bản contract hỗ trợ tường minh; mỗi thay
      đổi contract public phải cập nhật version, không dựa vào so sánh hash schema.
- [x] Xác định topic docs và entrypoint public duy nhất.

Đầu ra: contract nhỏ chạy được, không chỉ tài liệu mô tả API tương lai.
Gợi ý layout là `core/src/` và `core/docs/`, giữ nguyên ba thư mục catalog.
Đây là lựa chọn implementation đề xuất, không phải yêu cầu tách package ngay.

### 2. Di chuyển phần sở hữu core, giữ nguyên hành vi

- [x] Đưa schema, loader, kiểm tra path tài nguyên và dependency selection vào core.
- [x] Expose type/API qua entrypoint; consumer không import file nội bộ.
- [x] Đảm bảo core đọc/validate được mà không import `tool/` hay `adapters/`.
- [x] Cập nhật CLI, tests, tsconfig, build/pack và verification fingerprints.
      Giữ các kiểm tra chống symlink, path escape và byte resource hiện có.
- [x] Giữ nguyên definition/instructions/resources và migration hashes.

Đầu ra: tách module thật, CLI vẫn dùng được catalog và source option cũ.

### 3. Làm core tự mô tả

- [x] Bổ sung mô tả field tại nguồn khai báo; xuất schema máy đọc được và tài liệu
      tham chiếu, gồm kiểu/default/required/enum và ngữ nghĩa.
- [x] Đưa concept/format/ngữ nghĩa dùng chung vào docs thuộc core; API đọc được
      các docs này trong checkout và artifact đã đóng gói.
- [x] Gộp hoặc thay phần tài liệu trùng lặp bằng link; giữ hướng dẫn authoring,
      native mapping và installer ở đúng nơi. Không tạo thêm bản author song song.

Đầu ra: người viết adapter hiểu core từ public API và docs của core.

### 4. Tách adapter và bổ sung compatibility

- [x] Đưa interface/helper render thuộc adapter ra khỏi installer/tool implementation;
      adapter tiếp tục trả file trong bộ nhớ, không ghi filesystem hay gọi network.
- [x] Khai báo version contract hỗ trợ và kiểm tra trước `check`/`render`;
      mismatch báo expected/actual, chặn cả đường gọi render trực tiếp.
- [x] Báo cáo compatibility có status tổng thể và issue theo field/contract:
      đường dẫn field, nguyên nhân, hệ quả, mức độ. Cần xét cả tổ hợp field.
- [x] `supported`: toàn bộ yêu cầu được bảo toàn; `limited`: sai khác có thể
      chấp nhận và được công khai; `unsupported`: không giữ yêu cầu bắt buộc.
- [x] Field mới ảnh hưởng hành vi chưa hiểu phải chặn. Metadata hiển thị bị mất
      có thể limited; không tự coi mọi field optional là bỏ qua được.
- [x] Installer trình bày báo cáo và dùng cơ chế `--accept-limitations` hiện có;
      `--yes` không vượt compatibility, conflict hoặc quyền bắt buộc.

Đầu ra: biết rõ lý do cài đầy đủ/có giới hạn/bị chặn, giữ mapping native hiện có.

### 5. Kiểm chứng, rút gọn docs và đóng vòng

- [x] Test core qua public API: schema/docs đầy đủ, default/ràng buộc, nguồn core
      độc lập, resource/reference/path sai bị từ chối và consumer mẫu tối thiểu.
- [x] Test adapter: contract mismatch, supported/limited/unsupported, issue theo
      field, policy không enforce được và render không vượt bước kiểm tra.
- [x] Test installer: hiển thị/accept giới hạn, unsupported/mismatch không ghi
      file; lifecycle hiện có và output native không regression.
- [x] Chạy `npm run typecheck`, `npm test`, build và validate content. Smoke gói
      npm trong context tạm để kiểm tra API/docs/catalog và CLI được đóng gói đủ.
- [x] Cập nhật fingerprint tooling theo source mới, giữ evidence cũ trung thực;
      sinh summary bằng `npm run verification -- report`. Không đổi fingerprint
      hồ sơ cũ để giả làm lượt kiểm chứng mới.
- [x] Kiểm tra discovery/render-install trên OpenCode, Codex, Claude Code ở
      global/project tạm khi binary có sẵn; thiếu điều kiện ghi rõ blocker.
      Đây là refactor tooling, không tự nhận tất cả stuff đã verified runtime.
      Nếu phát sinh đổi workflow hoặc mapping: chọn target/scenario trước,
      kiểm chứng runtime và gate từng stuff/harness theo `docs/testing.md`.
- [x] README và docs dẫn đến contract core mới; bỏ phần trùng lặp/lỗi thời.
      Không hand-edit verification summary hoặc generated dist.

## Tiêu chí hoàn thành

Core có thể được consumer độc lập import, lấy schema/docs và load catalog mà
không cần tool/adapter. Adapter không phụ thuộc nội bộ core, không âm thầm bỏ
field hành vi, và chặn contract không hiểu. CLI báo giới hạn cụ thể trước khi
cài, giữ hành vi và bảo vệ file hiện có. Checks implementation đạt; giới hạn
runtime và evidence stale được báo đúng, không suy diễn từ unit test.

## Checkpoint cuối — 2026-10-09

| Bước | Commit / trạng thái |
|---|---|
| 1. Public contract | `112057a` |
| 2. Core độc lập | `cf838eb` |
| 3. Core tự mô tả | `55f0a81` |
| 4. Adapter độc lập và compatibility | `af1eebb` |
| 5. Kiểm chứng và đóng vòng | Hoàn thành; commit chứa checkpoint này |

- Core public entrypoint: core/src/index.ts. Canonical docs: core/docs/README.md,
  concepts.md, format.md, fields.md. Schema/description/category cùng nguồn;
  field reference sinh bằng npm run core:docs. Contract 3, YAML schema 1.
- Adapter public entrypoint: adapters/index.ts; interface/factory/native helpers
  thuộc adapters. Revision 2 hỗ trợ contract 3; check/render chung guard version,
  kind và field vocabulary. Không import tool hoặc nội bộ core. Guard không so
  toàn bộ kiểu/default; thay ngữ nghĩa phải tăng version contract.
- Compatibility issue gồm field/status/reason/effect. Unmapped metadata limited,
  unknown hoặc unmapped behavior/content/policy blocked. CLI trình bày và xin
  acceptance; --yes không vượt limited, --accept-limitations không vượt unsupported.
  Manifest revision thực và legacy revision 1 đều được hỗ trợ.
- 16 assets giữ nguyên content/migration baseline. 67 native output hashes khớp
  baseline 55f0a81; không thay mapping hoặc publish. Fingerprint tooling theo
  module mới; evidence cũ giữ nguyên, summary sinh bằng verification report.
- Tests đã đủ checklist core/adapter/installer; không thêm test trùng implementation.
  Typecheck, build, 51/51 tests, validate 16 assets, generated docs, verification
  integrity/summary và tarball API/docs/consumer/CLI đều đạt. Tarball dependencies
  dùng symlink checkout, chưa kiểm tra fresh registry install.
- Smoke mới: Codex 0.162.0, OpenCode 1.18.35 cài/discover probe đạt cả global/project,
  explicit/matching-request. Claude filesystem render/install đạt; discovery
  blocked vì thiếu CLI. Không có model runs mới hoặc per-stuff workflow Passed.
  [Report và artifact](../runtime/core-module-boundary-2026-10-09.md) giữ kết quả,
  môi trường, fingerprint và blocker. Đây là giới hạn runtime, không phải công
  việc implementation còn thiếu; checklist smoke hoàn tất với blocker đã ghi.
- Docs đã rà đường dẫn module cũ, bỏ trạng thái API tương lai và README in-progress;
  docs/concepts.md giữ trang trỏ để không phá link. Historical plan/baseline và
  evidence revision 1 giữ nguyên, không sửa thành revision mới.

Refactor hoàn tất trong phạm vi đã chốt; không cần bước implementation tiếp theo.
Nếu tiếp tục kiểm chứng workflow, chọn stuff/harness/scenario theo docs/testing.md,
ưu tiên giải quyết Claude CLI/auth nếu muốn phủ target đó. Không suy diễn từ smoke
hoặc làm mới fingerprint evidence cũ để lấy Passed.

Prompt tiếp tục: “Đọc checkpoint docs/plans/core-module-boundary.md và git status;
refactor đã xong. Xác định target workflow cần kiểm chứng trước khi mở công việc mới.”
