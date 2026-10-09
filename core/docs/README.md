# Public contract core

Contract API hiện tại: **2**. Format YAML hiện tại: **schema_version: 1**.
Hai phiên bản độc lập với revision adapter. Schema, loader, kiểm tra đường dẫn
và dependency selection thuộc core; core không import tool hoặc adapter.
Module chạy được chỉ với Node.js 22+, yaml và zod. Xem tiến độ trong
[plan](../../docs/plans/core-module-boundary.md).

## Dùng interface

Entry point duy nhất: `core/src/index.ts`. Sau `npm run build`, consumer ESM có
thể dùng bản compile `dist/core/src/index.js` cùng declaration `index.d.ts`;
chưa có package npm riêng hoặc package export alias.

```js
import { getContract, getDocs, loadCatalog, CoreError }
  from './dist/core/src/index.js';

const contract = getContract();
console.log(contract.contractVersion);
console.log(contract.kinds.skill.schema);
console.log(contract.kinds.skill.fields.activation);
console.log(getDocs('fields'));
const catalog = await loadCatalog('/absolute/path/to/core');
```

| API | Kết quả |
|---|---|
| `getContract()` | Snapshot JSON: phiên bản, schema input theo kind, ý nghĩa/nhóm field và ràng buộc |
| `getDocs(topic)` | Markdown; topic là `concepts`, `format`, `fields` hoặc `api` |
| `loadCatalog(coreRoot)` | Promise của Map full key → Asset đã validate và áp dụng default |
| `selectAssets(catalog, only?)` | Chọn full key, bổ sung helper agent; mặc định chọn tất cả |
| `definitionSchema`, `relativePath` | Validator Zod cho cấu trúc definition và đường dẫn tương đối |
| `inside(root, relative)` | Validate và resolve đường dẫn bên trong root |
| `assertNoSymlinks(file)` | Kiểm tra symlink ở đường dẫn và các ancestor tồn tại |

Type public: `CoreContract`, `CoreSchema`, `KindContract`, `StuffKind`, `FieldCategory`,
`FieldMeaning`, `Definition`, `Asset`, `Catalog`, `DocsTopic`, `CoreErrorCode`.
Asset gồm `key`, `definition`, `body`, `resources`. Command có body rỗng;
resources là Map đường dẫn tương đối → Buffer, giữ nguyên byte.

`loadCatalog` yêu cầu core root, không suy ra cwd/home hoặc catalog mặc định.
CLI vẫn nhận checkout qua `--source`; việc resolve source thuộc biên CLI.
`CoreError.code` là `CATALOG_INVALID` hoặc `UNKNOWN_DOCS_TOPIC`. Lỗi catalog
giữ `cause` và ngữ cảnh gốc trong message; consumer không cần parse message để
phân loại lỗi. Không cam kết format chi tiết lỗi nội bộ Zod/filesystem.
Các validator và helper selection/path có thể báo lỗi Zod hoặc Error thông
thường. CoreError chỉ bọc lỗi của loadCatalog/getDocs. Consumer import tất cả
qua entrypoint, không qua schema/catalog/paths nội bộ.

## Field và ý nghĩa

Bảng field đầy đủ được tạo bởi `getDocs('fields')` từ schema hiện tại và metadata
contract; không duy trì thêm bảng viết tay. Schema cung cấp type, required,
default và enum; contract bổ sung ý nghĩa và các nhóm:

| Nhóm | Trách nhiệm adapter |
|---|---|
| `structure` | Giữ format và identity, không tự đổi kind/ID |
| `metadata` | Dùng cho hiển thị; thiếu mapping có thể báo limited |
| `content` | Giữ hướng dẫn, mô tả và resource; description có thể ảnh hưởng discovery |
| `behavior` | Giữ cách kích hoạt, role hoặc tham chiếu workflow |
| `enforcement` | Dùng cơ chế quyền thực thi; lời nhắc không thay permission |

Nhóm không tự quyết định field nào được bỏ qua. Optional chỉ nghĩa được phép
không khai báo ở input, không nghĩa adapter được bỏ khi user đã khai báo.
JSON Schema mô tả cấu trúc nhưng không đủ cho custom refinements và quan hệ/file;
`loadCatalog` là validation đầy đủ. Các ràng buộc này nằm trong `getContract().rules`.

Mô tả field hiện bổ sung bên cạnh schema và được test để không thiếu/thừa field.
Bước 3 sẽ gom metadata với nguồn khai báo validator và gộp tài liệu concept cũ;
chưa tuyên bố đã có một nguồn khai báo hoàn chỉnh cho schema và ngữ nghĩa.

## Phiên bản và tương thích

Tăng contract version khi đổi API public, schema, default, ngữ nghĩa hoặc ràng
buộc. Sửa chính tả/diễn đạt không đổi nghĩa thì không cần tăng. Trước mắt adapter
sẽ khai báo danh sách phiên bản hiểu được; bản không hiểu phải bị chặn trước
render. Version check và issue theo field được triển khai ở bước 4, chưa có ở CLI.
Version 2 bổ sung validator, path helper và selection public để consumer bỏ
import nội bộ tool. Version 1 đã có getContract/getDocs/loadCatalog; format YAML,
default và ngữ nghĩa stuff giữ nguyên ở version 2.

`supported` bảo toàn contract; `limited` công khai khác biệt có thể chấp nhận;
`unsupported` chặn yêu cầu bắt buộc không bảo toàn được. Không hiểu field hành vi
thì chặn, không âm thầm bỏ. Không thay chính sách native hiện có trong bước 2.
Mapping support và bằng chứng runtime vẫn là hai thông tin khác nhau.
