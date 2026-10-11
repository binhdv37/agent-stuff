# Kiểm chứng refactor core/adapter — 2026-10-09

Hồ sơ lịch sử, không là hướng dẫn session. macOS, core contract 3, YAML schema 1,
adapter revision 2; implementation commit `af1eebb`.
[Artifact](core-module-boundary-2026-10-09.json) giữ runner hash, version, scope và
fingerprints gốc; không làm mới chúng khi cleanup docs.

| Check | Kết quả |
|---|---|
| Core public API/standalone, adapter guard/issues, installer/lifecycle | Tests đạt |
| Native output | 67 hashes khớp baseline `55f0a81` |
| Typecheck/build/tests | 51/51 đạt, không skip |
| Validate/generated docs/verification integrity | 16 assets, 48 asset/harness pairs |
| Tarball | API/docs/catalog/render, declarations + strict TS consumer, CLI default source đạt |
| Codex 0.162.0, OpenCode 1.18.35 | Probe cài/discover global/project, explicit/matching-request |
| Claude Code | Filesystem render/install đạt; discovery blocked vì thiếu binary |

Quy trình discovery (lượt không gọi model, không copy auth, context tạm được xóa):

```bash
npm run build
node scripts/check-activation.mjs --harness all --scope both \
  --timeout-ms 20000 --output /tmp/core-module-discovery.json
```

Exit 2 do thiếu Claude; tám ca Codex/OpenCode discovered=true. Policy null từ
Codex discovery không chứng minh thiếu enforcement; OpenCode explicit vẫn limited.
Không có model runs mới hoặc per-stuff workflow Passed. Tarball dùng dependencies
symlink checkout, chưa fresh registry install. Không đổi native baseline/publish.
[Lượt đầy đủ trước cleanup](https://github.com/binhdv37/agent-stuff/blob/0cbbc14/docs/runtime/core-module-boundary-2026-10-09.md).
