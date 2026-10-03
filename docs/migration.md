# Ghi chú migration

## Nguồn nội dung

11 skill, 2 agent chính và 2 command đã chuyển vào `core/`; sau đó thêm agent
phụ chỉ đọc `bdv-plan-reviewer` cho planner. Hiện có 16 asset. Metadata YAML tách
khỏi Markdown. Resource của skill giữ nguyên đường dẫn tương đối, kể cả bốn tài liệu
`*-FORMAT.md` ở gốc teach. Hash nội dung skill và resource trước migration nằm ở
`tests/fixtures/migration-inventory.json` và được kiểm tra bằng test.

Tại mốc migration, chính sách kích hoạt giữ nguyên: 9 explicit-only, grill-me và
smart-commit là matching-request. Thay đổi sau migration được ghi riêng bên dưới.
Metadata giao diện handoff/teach được đưa vào core. Adapter
Codex sinh `agents/openai.yaml`; adapter Claude Code sinh native frontmatter.

## Hợp nhất command

| Command | Nội dung chung | Phần riêng được giữ |
|---|---|---|
| change-report | Skill change-report | Wrapper truyền đối số thành phạm vi; skill giữ yêu cầu kiểm tra git diff và các mục báo cáo |
| explain-code | Skill explain-code | Wrapper truyền target; skill vẫn yêu cầu hỏi lại khi target thiếu và đọc code trước khi giải thích |

Cả hai command lấy hướng dẫn từ skill khi build. Các khác biệt diễn đạt giữa bản
command cũ và skill đã được thay bằng bản skill; không lưu hai bản workflow.
Codex dùng skill tương ứng; Claude Code đã cung cấp slash command từ skill nên
adapter không sinh thêm command trùng tên.

## Agent và thay đổi có chủ đích

- Sửa lỗi YAML của description planner chứa dấu `:` chưa được quote.
- Core giữ vai trò primary của cả hai agent.
- Planner dùng `.auragent/plans/` tương đối với project, thay cho đường dẫn gốc
  filesystem `/.auragent/plans/`. Nội dung hỏi người dùng dùng mô tả khả năng thay
  cho tên tool `question`.
- Core planner giữ ý định đọc workspace, ghi trong thư mục plan và ủy nhiệm;
  quyền shell mkdir tuyệt đối cũ không được mang sang core. Shell mặc định deny.
- Architect chuyển shell ask thành shell deny để giữ đúng vai trò chỉ đọc.
- Planner được phép ghi vào `.auragent/plans/` qua `edit`, nhưng shell vẫn deny.
  Planner chỉ gọi `bdv-plan-reviewer` chỉ đọc, thay cho các general subagent có
  thể sửa file. CLI tự cài helper khi chọn planner.

## Cài đặt

`install.sh` hiện là launcher từ checkout, không tải nhánh main rồi thay cả thư
mục. Bỏ hướng dẫn `npx skills add` và cách `curl | bash`; clone checkout hoặc dùng
file tgz tạo bằng `npm pack`. Có thể chọn tag/commit bằng Git trước khi build.
CLI không tự tải release hoặc cập nhật chính nó.

Các thư mục `claude/`, `skills/` và `opencode/` cũ chỉ còn rỗng sau migration
nên đã xóa.
`prompts/` là bản nháp cá nhân không thuộc nội dung phân phối và cũng đã được
gỡ khỏi repo theo quyết định sau migration.

## Revision core ngày 2026-10-03: smart-commit

Theo yêu cầu user, viết lại `bdv-smart-commit`: đổi matching-request sang explicit,
duyệt một proposal gồm nội dung/message/commands cho staging và commit; chỉ stage
file cụ thể; kiểm tra lại trạng thái trước staging và commit; cảnh báo attribution
không rõ, mixed edits và file ngoài phạm vi đã staged. Push có proposal/approval
riêng, kiểm tra push destination thực tế và đưa link PR/MR sau thành công.
Thêm resource `scripts/change-snapshot.mjs` (Node.js 22+ và Git) chỉ capture/check,
không stage/commit/push. Conventional Commit ưu tiên scope theo code area và ticket
ở footer, theo convention riêng của repository khi có.

Sau boundary test, user cho phép `git commit --only` cho selected files tách biệt
khi đã duyệt toàn bộ working-tree content. Excluded index entries phải được giữ
nguyên trước/sau commit. Mixed hunks và staged-only không dùng fallback này;
dừng nếu index chứa excluded changes. Dùng literal pathspecs để file names không
trở thành glob/pathspec syntax. Đây là revision workflow có chủ đích, không phải
thay đổi adapter mapping.

Sau secret trace test, user duyệt thêm `scripts/inspect-changes.mjs`. Workflow
đọc candidate/convention contents qua helper trước khi đưa text vào model/tool
trace, gồm HEAD/index/working-tree và untracked files. File có nghi vấn credential
bị giữ lại toàn bộ nội dung; placeholder rõ ràng/environment references vẫn được
review. Không fallback raw read/diff. Detector heuristic, input/output có giới hạn;
không xác nhận scanner đầy đủ hoặc native enforcement. Snapshot helper giữ nguyên.

Sau runtime mixed/staged/drift, user duyệt sửa proposal freshness và cleanup:
mọi initial/revised proposal phải review → capture → review selected content →
strict check → trình proposal; staged-only không bỏ bước. Snapshot nằm trong
private skill-owned directory mới, tạo thất bại thì dừng thay vì dùng shared
harness folder. Khi workflow kết thúc/hủy/lỗi, xóa đúng owned files rồi rmdir
nếu empty; chỉ retain khi user yêu cầu, permission blocker phải báo path.
Ví dụ trong instructions không phải facts của repo. Lượt model tiếp theo vẫn bỏ
review sau capture ở một proposal và tạo nhầm empty directory trong worktree.
Thêm `prepare` vào snapshot helper: tự allocate private temp directory ngoài repo,
inspection → capture → inspection → strict comparison; chỉ trả review/snapshot
khi tất cả đạt. Fail sau allocation trả owned paths để cleanup, không trả review.
Workflow bắt buộc `prepare` cho mọi proposal, raw `capture` giữ làm low-level API.
Không đổi schema/resources/permission mapping; vẫn chỉ đọc Git, ghi temp artifact.

**Revision hiện tại theo yêu cầu user:** bỏ độ phức tạp trên. Skill chỉ đọc changes
bằng Git/file tools thông thường và dùng kiến thức trong session để cảnh báo edits
agent không làm, đưa scope/message/exact commands, đợi approval rồi execute.
Không capture/fingerprint/recheck trước execution; bỏ cả snapshot và inspection
helpers khỏi core/resources cùng tests dành riêng cho các helper đã bỏ. Không
tạo temporary directories/artifacts. Giữ explicit invocation, add exact paths,
staged-only/mixed scope disclosure, Conventional Commits và push approval riêng
sau khi đọc remote thực tế. Đây là đổi contract user yêu cầu, không giảm scenario
để che failure cũ; các mục helper bên trên là lịch sử và evidence cũ trở thành stale.

Giữ nguyên `tests/fixtures/migration-inventory.json` làm baseline lịch sử. Các hash,
activation và resource mới chỉ cho revision này nằm trong
`tests/fixtures/content-revisions.json`; test dùng revision đã giải thích này cho
smart-commit, vẫn đối chiếu nguyên baseline cho các skill còn lại. Hiện có 10 skill
explicit và chỉ grill-me matching-request. Evidence workflow cũ không xác nhận
revision mới; xem verification cho fingerprint và giới hạn hiện tại.

Bản cài từ installer cũ chưa có manifest. File trùng đích sẽ gây conflict; cần
backup và di chuyển các file đó trước khi dùng installer mới. CLI không xóa cả
thư mục skill và không tự nhận quyền sở hữu file cũ.

Manifest mới ở `.agent-stuff/installations/<scope>/<harness>.json` dưới home hoặc
project tương ứng. Bản thử nghiệm trước migration từng dùng đường dẫn không có
`<scope>`; không tự động nhập state thử nghiệm đó. Các lần thử đã dùng thư mục tạm.
