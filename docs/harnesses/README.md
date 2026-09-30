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

## Mẫu cho một phát hiện mới

```text
Ngày đọc docs:
Harness/client/phiên bản hoặc nhánh tài liệu:
Ý định portable:
Cơ chế native và điều kiện áp dụng:
Nguồn chính thức đã mở:
Mapping/test hiện có trong repo:
Hệ quả cho thiết kế (đánh dấu suy luận):
Điều cần xác minh khi triển khai:
```

Giữ phần giải thích ngắn; dẫn nguồn thay vì chép toàn bộ docs. Nếu thêm harness
mới, thêm ghi chú vào đây, đăng ký adapter riêng và cập nhật compatibility.
