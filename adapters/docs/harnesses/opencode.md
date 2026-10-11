# OpenCode: native baseline

Target: local **V1**, project `.opencode`, global `~/.config/opencode`.
Docs đọc **2026-09-30**, nhánh `/docs/`, không pin release; binary lúc author
chưa ghi nhận. Adapter `opencode`, revision 2; code `adapters/opencode/index.ts`.
Revision 2 giữ native mapping revision 1, không có lượt đọc docs mới.

## Mapping đang dùng

- [Skills](https://opencode.ai/docs/skills/): discovery còn nhận `.claude/skills`
  và `.agents/skills`; test isolated để tránh bản cài khác che kết quả. Name phải
  khớp folder, kebab-case ≤64 ký tự; description 1–1024. Unknown fields bị bỏ.
- V1 skill permission allow/ask/deny khác manual-only. Adapter dùng description
  guard cho explicit và báo limited; không có native explicit enforcement.
- [Agents](https://opencode.ai/docs/agents/): filename là tên; primary/subagent,
  singular permission. task patterns giới hạn model delegation; user vẫn có thể
  gọi helper trực tiếp bằng `@`.
- [Commands](https://opencode.ai/docs/commands/): filename thành slash entry,
  `$ARGUMENTS`, `$1` và interpolation native. Adapter inline workflow/wrapper,
  chặn skill có resources hoặc native interpolation trong đường command.
- [Permissions](https://opencode.ai/docs/permissions/): last-match-wins;
  catch-all trước exceptions. edit gate write/edit/patch; bash cho shell, task
  cho delegation. Scoped write cần shell deny và helper chỉ đọc cùng lúc.
- [Write implementation](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/write.ts):
  edit dùng path tương đối worktree, tạo parent directory. Link dev chưa pin;
  pin nguồn khi research lại. Planner policy cụ thể ở [compatibility](../compatibility.md).

UI metadata/input hint chưa mapping, báo limited. Tests:
`tests/core-adapter.test.ts`, `tests/agent-policy.test.ts`,
`tests/lifecycle.test.ts`, `tests/adapter-contract.test.ts`.

## Khác biệt cần giữ rõ

- [Config V1](https://opencode.ai/docs/config/): merge remote defaults → global →
  OPENCODE_CONFIG → project → .opencode directories → inline. Installer không
  sửa shared config. [Rules](https://opencode.ai/docs/rules/): AGENTS guidance,
  CLAUDE fallback; không mặc định cả hai file được đọc.
- **V2 chưa mapping.** [Skills V2](https://opencode.ai/v2/docs/skills/) có
  metadata.opencode/autoinvoke để tắt advertisement, không là deny mọi load;
  ID từ path, slash/menu và duplicate rules khác V1.
  [Permissions V2](https://opencode.ai/v2/docs/permissions/) dùng plural array,
  shell/subagent thay bash/task. Không đổi vài tên field rồi coi migration xong.

Chốt client/version và mở đúng nhánh docs khi đổi mapping; thử discovery và
allowed/denied behavior trước claim enforce. Runtime versions không là support range.

## Mốc cũ

Baseline revision 1 ghi 2026-10-01, docs 2026-09-30; runtime 1.18.32/1.18.33.
Revision 2 (2026-10-09) giữ permission/wrapper V1, báo metadata limited, gate core 3.
Discovery 1.18.35 không có model run. [Compatibility/evidence](../compatibility.md).
[Hồ sơ đầy đủ trước cleanup](https://github.com/binhdv37/agent-stuff/blob/0cbbc14/docs/harnesses/opencode.md).
