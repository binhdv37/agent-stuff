# Format core

Core root là thư mục catalog và module, độc lập với cấu trúc checkout của consumer:

```text
core-root/
  skills/<id>/definition.yaml
  skills/<id>/instructions.md
  agents/<id>/definition.yaml
  agents/<id>/instructions.md
  commands/<id>/definition.yaml
  src/                         # implementation thư viện
  docs/                        # concept, format, API, field reference
```

Loader chỉ nạp ba thư mục skills/agents/commands. src/docs không phải stuff.
Tên file instructions.md là quy ước; definition có thể tham chiếu tên khác.
Mọi loại có schema_version, kind, id và description; schema nghiêm ngặt từ chối
field lạ. Kind và ID phải khớp thư mục. Full key là kind/id; cùng ID ở các kind
khác nhau được phép. Quy ước authoring dùng bdv- cho skill/command và kebab-case
cho tất cả ID; validator chỉ enforce kebab-case và giới hạn độ dài.

## Vai trò của file

| File | Ý nghĩa |
|---|---|
| definition.yaml | Identity, metadata và cấu hình portable; format YAML hiện là schema_version 1 |
| File được instructions tham chiếu | Hướng dẫn UTF-8 không rỗng của skill/agent; giữ nội dung khi mapping |
| File được resources khai báo | Tài liệu, template hoặc asset hỗ trợ; giữ nguyên byte và quan hệ tham chiếu |

Command v1 chỉ tham chiếu workflow skill; không có instructions/resources riêng.
Native placeholders hoặc cấu hình harness thuộc adapter. Core không khai báo
file native cho từng harness.

## Field và validation

[Field reference](fields.md) được sinh từ validator và metadata cùng nguồn tại
schema. Nó ghi kiểu, required, mặc định, nhóm ý nghĩa và ràng buộc. Optional ở
input không nghĩa adapter được phép bỏ giá trị người dùng đã khai báo.

JSON Schema kiểm tra cấu trúc; custom refinements, quan hệ catalog và filesystem
được kiểm tra thêm qua loadCatalog. Đường dẫn instructions/resources phải tương
đối và ở trong asset; các path khai báo không có dot/dot-dot, backslash, colon,
NUL hoặc segment rỗng. File tham chiếu phải tồn tại và không qua symlink.
Resources không trùng và không dùng tên file reserved. Root-level resource hợp lệ.
Policy write_paths tương đối theo project, khác phạm vi đường dẫn resource.

Instructions định hình hành vi; policy cần enforcement quyền. Role, activation,
workflow và policy có contract riêng trong bảng field. Adapter phải báo giới hạn
hoặc chặn khi không giữ được contract, kể cả khi YAML đã validate thành công.

Xem [concepts](concepts.md) để hiểu các loại stuff và [API](README.md) để consume.
