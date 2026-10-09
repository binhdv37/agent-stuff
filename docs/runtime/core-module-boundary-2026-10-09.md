# Kiểm chứng refactor core/adapter

Ngày 2026-10-09, macOS, core contract 3, YAML schema 1, adapter revision 2.
Implementation baseline: commit `af1eebb`; bước đóng vòng chỉ sửa docs và lưu
report. [Artifact discovery](core-module-boundary-2026-10-09.json) giữ version,
scope, kết quả, hash runner và fingerprint implementation từng adapter.
Fingerprint được tính sau chỉnh diễn đạt API docs ở bước 5; không đổi ngữ nghĩa.

## Phạm vi và kết quả

Refactor giữ nguyên 16 assets, workflow, migration hashes và native output.
Đây là kiểm chứng tooling/module, không phải hồ sơ workflow Passed.

| Kiểm tra | Kết quả |
|---|---|
| Public core API, schema/docs/defaults, standalone catalog, invalid paths/references | Tests hiện có đạt |
| Adapter độc lập với tool, contract mismatch, unknown/unmapped behavior, issue và policy blockers | Tests hiện có đạt |
| CLI acceptance, unsupported/mismatch không ghi file, legacy manifest, lifecycle/recovery | Tests hiện có đạt |
| Native render regression | 67 output hashes khớp baseline `55f0a81` |
| Typecheck, build, npm test | Đạt; 51/51 tests, không skip |
| Core validate, generated docs, verification integrity/summary | Đạt; 16 assets, 48 asset/harness pairs |
| npm tarball | API/docs/catalog/render, declarations + strict TypeScript consumer và CLI default source đạt |
| Codex CLI 0.162.0 | Probe cài và discovery đạt global/project với explicit và matching-request |
| OpenCode 1.18.35 | Probe cài và discovery đạt global/project với explicit và matching-request |
| Claude Code | Render-install cả scopes đạt qua filesystem tests; runtime discovery blocked vì thiếu binary |

## Tái hiện discovery

```bash
npm run build
node scripts/check-activation.mjs --harness all --scope both \
  --timeout-ms 20000 --output /tmp/core-module-discovery.json
```

Runner dùng core probe riêng, cài bằng shared installer vào home/project tạm,
rồi gọi Codex app-server skills/list hoặc OpenCode debug skill. Context được
xóa sau mỗi ca. Không copy auth, không gọi model; personal config không được dùng.
Exit code **2** trong lượt này vì Claude CLI không có. Cả tám ca Codex/OpenCode
có discovered=true. Codex không trả policy qua discovery API; policy null không
chứng minh thiếu enforcement. OpenCode explicit vẫn limited theo contract cũ.

## Giới hạn

Chưa chạy model behavior mới hoặc kiểm chứng tất cả stuff. Evidence per-stuff cũ
giữ nguyên và có thể stale; xem [summary](../verification/README.md). Không sửa
fingerprint hồ sơ cũ để biến thành kết quả mới. Claude runtime còn cần máy có CLI
và auth; đây là blocker đã ghi nhận, không chặn hoàn tất refactor tooling.

Smoke tarball dùng dependency từ checkout qua symlink; chưa thử cài dependency
mới từ registry. Declaration consumer Node dùng --types node. Không publish gói,
đổi mapping hoặc làm mới documentation baseline native trong lượt này.
