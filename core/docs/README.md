# Public contract core

Contract API hiện tại: **3**. Format YAML hiện tại: **schema_version: 1**.
Hai phiên bản độc lập với revision adapter. Schema, loader, kiểm tra đường dẫn
và dependency selection thuộc core; core không import tool hoặc adapter.
Module chạy được chỉ với Node.js 22+, yaml và zod. Bắt đầu từ
[concepts](concepts.md), [format](format.md) và [field reference](fields.md).

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
`CoreError.code` là `CATALOG_INVALID`, `UNKNOWN_DOCS_TOPIC` hoặc `DOCS_UNAVAILABLE`.
Lỗi catalog/docs giữ cause và ngữ cảnh lỗi; consumer không cần parse message để
phân loại. Không cam kết format chi tiết lỗi nội bộ Zod/filesystem.
Các validator và helper selection/path có thể báo lỗi Zod hoặc Error thông
thường. CoreError chỉ bọc lỗi của loadCatalog/getDocs. Consumer import tất cả
qua entrypoint, không qua schema/catalog/paths nội bộ.

## Field và ý nghĩa

Bảng [field reference](fields.md) và `getDocs('fields')` được sinh từ validator
có metadata tại cùng nguồn schema. Schema JSON cũng có description và
`x-core-category` trên từng field, kể cả policy lồng nhau. Schema cung cấp type,
required, default và enum; metadata bổ sung ý nghĩa và các nhóm:

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

Khi sửa schema/mô tả, chạy `npm run build` rồi `npm run core:docs` để sinh lại
bảng. `npm test` kiểm tra bảng không bị stale. Build copy docs vào dist/core/docs;
getDocs đọc đúng các file concept/format/API từ module bằng đường dẫn tương đối
với entrypoint, không dựa vào cwd hoặc tài liệu ở tool.

## Phiên bản và tương thích

Tăng contract version khi đổi API public, schema, default, ngữ nghĩa hoặc ràng
buộc. Sửa chính tả/diễn đạt không đổi nghĩa thì không cần tăng. Adapter
khai báo danh sách phiên bản hiểu được; bản không hiểu bị chặn trước
render. Version check và báo cáo issue theo field thuộc trách nhiệm adapter;
core không kiểm tra harness hoặc thực thi policy native.
Version 2 bổ sung validator, path helper và selection public để consumer bỏ
import nội bộ tool. Version 1 đã có getContract/getDocs/loadCatalog; format YAML,
default và ngữ nghĩa stuff giữ nguyên. Version 3 bổ sung annotation field trong
schema JSON và lỗi DOCS_UNAVAILABLE khi module thiếu tài liệu đã đóng gói.

`supported` bảo toàn contract; `limited` công khai khác biệt có thể chấp nhận;
`unsupported` chặn yêu cầu bắt buộc không bảo toàn được. Không hiểu field hành vi
thì chặn, không âm thầm bỏ. Native mapping thuộc adapter, không thuộc schema core.
Mapping support và bằng chứng runtime vẫn là hai thông tin khác nhau.
