# Nghiên cứu nền tảng harness

Đọc ngày **2026-09-30**, từ tài liệu chính thức được mở trực tiếp. Phạm vi:
local CLI, discovery, skills, agents, commands, project guidance và permissions.
Không nghiên cứu toàn bộ API, plugin marketplace hoặc dịch vụ cloud.

| Harness | Ghi chú | Phạm vi phiên bản |
|---|---|---|
| Codex | [codex.md](codex.md) | Tài liệu hiện hành; không gắn với một CLI binary đã thử |
| Claude Code | [claude-code.md](claude-code.md) | Tài liệu hiện hành, có mốc phiên bản ở tính năng liên quan |
| OpenCode | [opencode.md](opencode.md) | Tách tài liệu V1 và V2; adapter hiện tại theo V1 |

Các ghi chú giải thích **khả năng harness theo docs** và hệ quả thiết kế cho repo.
[Compatibility](../compatibility.md) vẫn là nơi duy nhất ghi trạng thái hỗ trợ
của adapter và bằng chứng runtime. Lượt nghiên cứu này không chạy model/runtime,
không đổi mapping và không nâng trạng thái hỗ trợ.

## Dùng trong session mới

1. Theo [flow phát triển](../harness-development.md), đọc ghi chú của harness
   liên quan và phần compatibility tương ứng.
2. Đọc adapter, schema và test; phân biệt capability native với mapping đã có.
3. Khi thay đổi native behavior, mở lại nguồn được dẫn tại đoạn liên quan.
   Kiểm tra đúng sản phẩm/client, phiên bản và điều kiện scope/trust.
4. Cập nhật đoạn ghi chú bị ảnh hưởng cùng ngày kiểm tra. Ghi nguồn thay thế khi
   URL đổi; không suy ra capability bị xóa chỉ vì một URL lỗi hoặc redirect.
5. Ghi test/discovery/runtime mới vào compatibility, không biến ghi chú này
   thành bảng hỗ trợ thứ hai.

## Hồ sơ tham chiếu bắt buộc của adapter

Mỗi adapter sở hữu hồ sơ kiến thức native trong ghi chú harness tương ứng ở đây.
Hồ sơ được version-control cùng implementation và đóng gói trong distribution.
Các phần về capabilities chưa implement phải được phân biệt với baseline thực
sự dùng cho mapping. Không cần sao chép toàn bộ tài liệu bên ngoài.

Một baseline phải lưu:

- Adapter ID và revision trong code; đây không phải phiên bản harness.
- Target sản phẩm/client, native format family (ví dụ OpenCode V1) và scope.
- Phiên bản harness dùng khi phát triển nếu đã ghi nhận; phiên bản đã thử runtime
  được dẫn sang compatibility. Ghi `chưa ghi nhận` nếu dữ liệu lịch sử thiếu.
- Tài liệu cụ thể: URL, tiêu đề/mục, nhánh/version nếu có, ngày mở thực tế và
  quy tắc mapping rút ra. Dẫn permalink/commit khi nguồn có phiên bản cố định;
  với URL thay đổi theo thời gian, lưu tóm tắt quy tắc và ghi rõ docs không pin.
- Mapping code, test liên quan, giả định, điều chưa xác minh và lý do chọn cơ chế.

Khi đổi mapping hoặc target harness, thêm baseline có ngày mới và giữ mốc cũ
trong cùng hồ sơ hoặc tài liệu lịch sử được link từ đó. Ghi phần thay đổi so với
baseline trước; không sửa ngày đọc cũ thành hôm nay khi chưa mở lại nguồn. URL
đơn lẻ không đủ vì nội dung tại URL có thể đã thay đổi. Không ghi một test version
thành minimum/maximum supported version hoặc cam kết các bản tương lai.

Khi harness cập nhật hoặc có regression, lấy client/version và config thực tế,
đối chiếu baseline, mở lại nguồn chính thức rồi tái kiểm chứng discovery, mapping
và các ràng buộc liên quan. Ghi kết quả mới vào compatibility, giữ bằng chứng cũ
với phạm vi của nó. Không tự nâng target từ V1 sang V2.

Đây là yêu cầu tài liệu cho quá trình phát triển. Interface adapter hiện chỉ có
revision số; CLI/manifest chưa phát hiện phiên bản binary hay kiểm tra version
range của harness. Nếu cần chức năng đó, phải thiết kế và triển khai riêng.

### Mẫu baseline

```text
Ngày lập/cập nhật hồ sơ:
Adapter ID/revision và mapping code:
Target sản phẩm/client, format family, scope:
Phiên bản dùng khi phát triển (hoặc chưa ghi nhận):
Ngày đọc docs thực tế:
Nguồn: tiêu đề/mục, URL, version/commit hoặc docs không pin:
Quy tắc mapping và giả định:
Test liên quan:
Runtime evidence: link compatibility, version/config đã thử:
Điều chưa xác minh:
Thay đổi so với baseline trước và link mốc cũ:
```

Với phát hiện chưa implement, ghi ý định portable, cơ chế native và điều cần
xác minh; đánh dấu suy luận riêng. Nếu thêm harness mới, thêm hồ sơ vào đây,
đăng ký adapter và cập nhật compatibility.
