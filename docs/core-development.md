# Flow phát triển stuff

Đọc [concepts](../core/docs/concepts.md), [format](../core/docs/format.md) và
[fields](../core/docs/fields.md) trước khi dùng flow này. Dùng
[harness development](harness-development.md) khi làm mapping, native config và
bằng chứng adapter; [adapter development](adapter-development.md) mô tả CLI.

## Bắt đầu từ một vấn đề hoặc ý tưởng

User có thể dùng `painpoint:`, `idea:`, `improve:`, `adapt:` hoặc `check:` theo
[entry points](entry-points.md). Agent bắt đầu từ hành vi/mục tiêu, đọc thành phần
liên quan và đề xuất giải pháp; user không cần chọn loại stuff trước. Khi có yêu
cầu triển khai, đi tiếp các bước bên dưới. Với yêu cầu chỉ đánh giá hoặc gợi ý,
kết thúc bằng phát hiện/phương án mà chưa sửa nội dung.

## 1. Diễn giải request bằng concept core

Xác định i-skill, i-command, i-agent hoặc nhu cầu loại mới. Ghi input, output,
hành vi mong muốn, ranh giới hoạt động và tiêu chí đạt bằng ngôn ngữ độc lập với
harness. Xác định harness/scope dự định dùng để kiểm chứng, không để khả năng
của một harness định nghĩa lại concept core.
Chốt các scenario bắt buộc trước khi triển khai theo [testing guide](testing.md).

Với i-skill mới, hỏi automatic invocation nếu preference chưa được xác lập;
mặc định explicit. Kiểm tra flow và asset hiện có trước khi tạo nội dung mới.

## 2. Kiểm tra contract hiện tại

Đọc asset tương tự, schema, loader, adapter và test liên quan. Phân loại yêu cầu
thành core value, cấu hình portable, mapping native hoặc preference cài đặt.
Nếu format hiện tại biểu đạt đủ, author trực tiếp. Không thêm field cho mỗi
request mới chỉ vì request chưa từng xuất hiện.

Nếu chưa đủ, đề xuất mở rộng trước khi implement. Ghi quyết định trong
issue/PR hoặc tài liệu thiết kế, gồm:

- Use case và vì sao instructions/contract hiện tại chưa đủ.
- Ý nghĩa, kiểu, mặc định, phạm vi tác động, tổ hợp xung đột và trường hợp lỗi.
- Hành vi được phép/bị cấm và mức enforce cần thiết.
- Mapping dự kiến, giới hạn từng harness và phương án thay thế.
- Ảnh hưởng schema, loader, format cũ, distribution và kế hoạch kiểm chứng.

Chỉ tạo decision riêng trong `docs/decisions/` khi cần lưu quyết định kiến trúc
lâu dài, như loại stuff mới, breaking change hoặc cơ chế override. Làm rõ khi
các cách hiểu hoặc phương án thay thế làm thay đổi hành vi user yêu cầu.

## 3. Đánh giá adapter trước khi cam kết hỗ trợ

Với config/loại mới hoặc mapping thay đổi, theo
[quy trình mapping](harness-development.md#flow-cho-mapping) để research,
đánh giá supported/limited/unsupported và lưu baseline adapter. Báo giới hạn
và phương án thay thế trước khi cam kết hỗ trợ. Nội dung portable dùng mapping
đã có không cần research lại harness nếu không có dấu hiệu regression.

## 4. Author và implement từ nguồn

Viết core value một lần trong `core/`, metadata/config trong `definition.yaml`
và khai báo resources. Thay schema/loader khi contract cần mở rộng; triển khai
compatibility check và render trong adapter. Chỉ đổi installer nếu vòng đời file
cần thay đổi. Không tạo authoring copies hoặc sửa file sinh trong `dist/`.

Test ngữ nghĩa/validation thuộc core; test chuyển đổi thuộc adapter; test file,
conflict và recovery thuộc installer. Với ràng buộc, kiểm tra cả trường hợp được
phép và bị cấm. Giữ migration baseline trừ khi chủ động sửa workflow cũ và có
giải thích cho thay đổi hash.

## 5. Kiểm chứng và hoàn tất

Theo [testing guide](testing.md): validate, render/install, discovery và chạy
workflow thật trong context tạm trên target đã chọn. Lưu hồ sơ gần nhất và
evidence từng stuff/harness, kể cả Failed/Blocked; sinh bảng tổng hợp. Chạy
implementation tests khi có thay đổi code và gate `--require-passed` cho từng
target trước khi báo hoàn tất kiểm chứng. Test adapter chung không thay thế
test workflow; bằng chứng adapter vẫn ghi trong compatibility.

Thêm public asset vào README, cập nhật glossary nếu đổi concept, development
guide nếu đổi format/CLI và hồ sơ adapter nếu đổi mapping. Publish/tag là hành
động riêng. Nếu workflow chưa đạt gate, báo phần đã triển khai và phần kiểm
chứng còn thiếu; không kết luận rằng nó chạy được.

## Ví dụ: i-skill chỉ hoạt động buổi chiều

Đây là ví dụ thiết kế; schema hiện tại chưa có config thời gian.

Trước tiên làm rõ “buổi chiều”: khung giờ, timezone, cách lấy thời gian đáng tin
cậy, xử lý không đọc được clock, giới hạn automatic invocation hay cả explicit
invocation, và kiểm tra lúc kích hoạt hay trong suốt workflow.

Nếu yêu cầu là workflow kiểm tra giờ rồi từ chối ngoài khung giờ, xem nó có thể
thuộc instructions hay không và báo mức phụ thuộc vào model/tool. Nếu yêu cầu
là harness không được kích hoạt skill ngoài giờ, đề xuất contract gating cùng
cấu hình có schema. Hai yêu cầu có tiêu chí kiểm chứng khác nhau.

Adapter research cơ chế tương ứng của từng harness. Nếu không có mapping giữ
được gating bắt buộc, báo unsupported và đưa phương án như kiểm tra trong
workflow hoặc cơ chế bên ngoài nếu có thiết kế phù hợp. Chỉ chuyển sang phương
án khác khi user đồng ý thay đổi ngữ nghĩa; không gọi prompt guard là enforcement.

Kiểm chứng gồm trong giờ, ngoài giờ, hai biên của khoảng giờ, timezone và lỗi
clock; phân biệt explicit/automatic theo contract đã chốt. Không thêm field
thời gian vào schema chỉ để minh họa flow này.
