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

## Authoring portable stuff

1. Đọc [concepts](concepts.md), asset tương tự và contract hiện có. Xác định input,
   output, hành vi/ràng buộc và tiêu chí đạt; ưu tiên sửa/tái sử dụng trước khi tạo mới.
2. Với skill mới, xác lập preference automatic invocation; mặc định explicit.
   Kiểm tra format biểu đạt đủ chưa, không thêm field chỉ vì có request mới.
3. Viết workflow/role một lần trong instructions, config trong definition.yaml;
   khai báo đúng resources. Command dùng lại workflow skill, không sao chép body.
4. Validate bằng loadCatalog; test ngữ nghĩa, defaults, lỗi và ràng buộc ở core.
   Việc render/install/run trên harness là kiểm chứng của consumer, ngoài core.

Nếu cần mở rộng contract, ghi use case, nghĩa/type/default, tổ hợp xung đột, mức
enforce, lỗi và ảnh hưởng format/API trước khi implement. Làm rõ phương án đổi
semantics; không biến giới hạn của một harness thành định nghĩa concept core.
Loại mới cần schema, loader/catalog, validation và tài liệu; không tạo framework
tổng quát khi chưa có nhu cầu. Thay schema/field metadata cùng nguồn rồi regenerate
fields theo [API](README.md); không sửa bảng generated bằng tay.

Giữ byte nội dung/resource và preference khi migration. Nếu chủ động đổi workflow,
ghi lý do content revision thay vì sửa hash baseline để che thay đổi.
