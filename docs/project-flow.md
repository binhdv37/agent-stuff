# Luồng chính: core → adapter → installer

Viết stuff một lần trong core, chuyển thành file native qua adapter, rồi cài
vào global/project qua installer. Harness đọc các file đã cài và chạy workflow.

| Thành phần | Trách nhiệm | Đầu ra |
|---|---|---|
| **Core** | Định nghĩa concept, file/field, schema và ngữ nghĩa; đọc/validate nội dung | Catalog gồm definition đã áp dụng default, instructions và resources |
| **Adapter** | Kiểm tra contract và khả năng bảo toàn yêu cầu; render theo harness | Compatibility report và các file trong bộ nhớ |
| **Installer** | Lập preview, kiểm tra conflict, áp dụng thay đổi và quản lý state | File trong thư mục đích và manifest theo dõi chúng |

Core không phụ thuộc adapter/installer. Adapter dùng public API core, không ghi
filesystem. CLI điều phối các bước và xử lý lựa chọn/xác nhận của người dùng.

## Một lượt install

```text
definition.yaml + instructions + resources
  → core load/validate → chọn asset và helper agent cần thiết
  → adapter check compatibility → render file trong bộ nhớ
  → installer lập preview/conflict → chấp nhận giới hạn và xác nhận
  → apply file + manifest → harness discovery và chạy workflow
```

- Contract không hiểu hoặc yêu cầu bắt buộc không bảo toàn được: chặn render.
- `limited`: báo field, nguyên nhân và hệ quả; cần chấp nhận trước khi cài.
- Conflict với file chưa quản lý hoặc đã sửa cục bộ: chặn apply.
- `--dry-run` dừng ở preview; `--yes` không tự chấp nhận giới hạn.

## Ví dụ: bdv-api-handoff → Codex

Core đọc `core/skills/bdv-api-handoff/definition.yaml`, instructions và template
được khai báo. Adapter Codex render:

```text
skills/bdv-api-handoff/SKILL.md
skills/bdv-api-handoff/agents/openai.yaml
skills/bdv-api-handoff/references/handoff-template.md
```

Installer đặt các file này dưới `<project>/.agents/` hoặc `<home>/.agents/`,
ghi ownership/hash vào manifest để update/uninstall an toàn. Cài thành công
chưa chứng minh harness discovery hoặc workflow thực tế đã đạt kiểm chứng.

## Đọc tiếp khi cần

- [Core API và docs](../core/docs/README.md): concept, format, schema và field.
- [Adapter API](../adapters/README.md): check, render và compatibility report.
- [CLI và installer](adapter-development.md): scope, vòng đời file và recovery.
- [Kiểm chứng](testing.md): discovery, behavior và evidence từng stuff/harness.
