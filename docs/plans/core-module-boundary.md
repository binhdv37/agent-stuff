# Tách core thành module độc lập

Ngày: 2026-10-09. Trạng thái: hoàn thành bước 1; bước 2 chưa triển khai.

## Mục tiêu và phạm vi đã thống nhất

Giữ luồng core → adapter → installer, đồng thời làm core tự mô tả và có public
interface để consumer sử dụng như thư viện bên thứ ba. Giảm việc phải ghép nhiều
tài liệu với code để hiểu contract. Đây là plan cho thay đổi mới, không thay thế
contract implementation hiện tại cho đến khi từng bước được triển khai.

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

## Hiện trạng đã kiểm tra

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

- [ ] Đưa schema, loader, kiểm tra path tài nguyên và dependency selection vào core.
- [ ] Expose type/API qua entrypoint; consumer không import file nội bộ.
- [ ] Đảm bảo core đọc/validate được mà không import `tool/` hay `adapters/`.
- [ ] Cập nhật CLI, tests, tsconfig, build/pack và verification fingerprints.
      Giữ các kiểm tra chống symlink, path escape và byte resource hiện có.
- [ ] Giữ nguyên definition/instructions/resources và migration hashes.

Đầu ra: tách module thật, CLI vẫn dùng được catalog và source option cũ.

### 3. Làm core tự mô tả

- [ ] Bổ sung mô tả field tại nguồn khai báo; xuất schema máy đọc được và tài liệu
      tham chiếu, gồm kiểu/default/required/enum và ngữ nghĩa.
- [ ] Đưa concept/format/ngữ nghĩa dùng chung vào docs thuộc core; API đọc được
      các docs này trong checkout và artifact đã đóng gói.
- [ ] Gộp hoặc thay phần tài liệu trùng lặp bằng link; giữ hướng dẫn authoring,
      native mapping và installer ở đúng nơi. Không tạo thêm bản author song song.

Đầu ra: người viết adapter hiểu core từ public API và docs của core.

### 4. Tách adapter và bổ sung compatibility

- [ ] Đưa interface/helper render thuộc adapter ra khỏi installer/tool implementation;
      adapter tiếp tục trả file trong bộ nhớ, không ghi filesystem hay gọi network.
- [ ] Khai báo version contract hỗ trợ và kiểm tra trước `check`/`render`;
      mismatch báo expected/actual, chặn cả đường gọi render trực tiếp.
- [ ] Báo cáo compatibility có status tổng thể và issue theo field/contract:
      đường dẫn field, nguyên nhân, hệ quả, mức độ. Cần xét cả tổ hợp field.
- [ ] `supported`: toàn bộ yêu cầu được bảo toàn; `limited`: sai khác có thể
      chấp nhận và được công khai; `unsupported`: không giữ yêu cầu bắt buộc.
- [ ] Field mới ảnh hưởng hành vi chưa hiểu phải chặn. Metadata hiển thị bị mất
      có thể limited; không tự coi mọi field optional là bỏ qua được.
- [ ] Installer trình bày báo cáo và dùng cơ chế `--accept-limitations` hiện có;
      `--yes` không vượt compatibility, conflict hoặc quyền bắt buộc.

Đầu ra: biết rõ lý do cài đầy đủ/có giới hạn/bị chặn, giữ mapping native hiện có.

### 5. Kiểm chứng, rút gọn docs và đóng vòng

- [ ] Test core qua public API: schema/docs đầy đủ, default/ràng buộc, nguồn core
      độc lập, resource/reference/path sai bị từ chối và consumer mẫu tối thiểu.
- [ ] Test adapter: contract mismatch, supported/limited/unsupported, issue theo
      field, policy không enforce được và render không vượt bước kiểm tra.
- [ ] Test installer: hiển thị/accept giới hạn, unsupported/mismatch không ghi
      file; lifecycle hiện có và output native không regression.
- [ ] Chạy `npm run typecheck`, `npm test`, build và validate content. Smoke gói
      npm trong context tạm để kiểm tra API/docs/catalog và CLI được đóng gói đủ.
- [ ] Cập nhật fingerprint tooling theo source mới, giữ evidence cũ trung thực;
      sinh summary bằng `npm run verification -- report`. Không đổi fingerprint
      hồ sơ cũ để giả làm lượt kiểm chứng mới.
- [ ] Kiểm tra discovery/render-install trên OpenCode, Codex, Claude Code ở
      global/project tạm khi binary có sẵn; thiếu điều kiện ghi rõ blocker.
      Đây là refactor tooling, không tự nhận tất cả stuff đã verified runtime.
      Nếu phát sinh đổi workflow hoặc mapping: chọn target/scenario trước,
      kiểm chứng runtime và gate từng stuff/harness theo `docs/testing.md`.
- [ ] README và docs dẫn đến contract core mới; bỏ phần trùng lặp/lỗi thời.
      Không hand-edit verification summary hoặc generated dist.

## Tiêu chí hoàn thành

Core có thể được consumer độc lập import, lấy schema/docs và load catalog mà
không cần tool/adapter. Adapter không phụ thuộc nội bộ core, không âm thầm bỏ
field hành vi, và chặn contract không hiểu. CLI báo giới hạn cụ thể trước khi
cài, giữ hành vi và bảo vệ file hiện có. Checks implementation đạt; giới hạn
runtime và evidence stale được báo đúng, không suy diễn từ unit test.

## Tiếp tục ở phiên sau

- Đã làm: bước 1 có public entrypoint `core/src/index.ts`, contract version 1,
  `getContract()`, `getDocs(topic)` và `loadCatalog(coreRoot)` chạy được.
  Field meanings/rules ở `core/src/contract.ts`; bảng field được tạo qua API,
  type/default/required/enum lấy từ validator hiện có. Hướng dẫn ở
  `core/docs/README.md`; README root có link đến API.
- Bridge tạm: `loadCatalogRoot` trong `tool/src/core/load.ts` nhận core root;
  `loadCore(source)` vẫn resolve checkout/core như cũ. API mới dùng bridge và
  schema tool; chưa đạt module standalone về dependency. Metadata chưa được
  gom với validator; việc đó thuộc bước 3.
- Build đã include core/src, package files đã include dist/core. Chưa kiểm tra
  tarball phân phối; smoke packaging nằm trong các bước tiếp theo.
- Checks ngày 2026-10-09: `npm run typecheck` đạt; `npm test` 40/40 đạt (bao gồm
  4 test public contract mới); `npm run cli -- validate --source .` đạt 16 assets.
  `npm run verification -- report` và report check đạt; summary không đổi.
  Không sửa content hoặc native mapping, không tạo evidence workflow mới và
  không tuyên bố tất cả stuff đã verified runtime. Không có blocker bước 1.
- Chưa làm: bước 2–5, đặc biệt bỏ dependency tool, version check trong adapter
  và báo cáo issue theo field. Adapter/CLI hiện chưa dùng contract API mới.
- Bước kế tiếp: đọc AGENTS.md, kiểm tra git status, đọc plan này; bắt đầu bước 2
  bằng di chuyển schema/loader/path/dependency selection vào core, cập nhật
  consumer/fingerprints và loại bridge. Kiểm tra thay đổi mới trước khi tiếp tục.
- Sau mỗi bước: cập nhật checkbox, ghi file thay đổi, checks/kết quả, blocker và
  hành động tiếp theo tại mục này. Một bước chỉ đánh dấu xong khi đạt đầu ra.
- Không cần hỏi lại sáu quyết định; chỉ làm rõ khi phát hiện phương án buộc phải
  thay đổi ngữ nghĩa đã chốt. Không mở rộng sang đổi workflow/publish trong plan này.

Prompt tiếp tục: “Đọc docs/plans/core-module-boundary.md và tiếp tục triển khai
từ bước chưa hoàn thành đầu tiên, giữ nguyên sáu quyết định đã chốt.”
