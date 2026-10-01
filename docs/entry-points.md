# Entry point khi làm việc với Agent-stuff

Bạn có thể bắt đầu bằng vấn đề hoặc ý tưởng, không cần biết nên tạo loại stuff
nào. Prefix giúp Agent chọn cách tiếp cận trước khi đi vào
[flow phát triển](core-development.md).

## Cú pháp

```text
<prefix>: <mô tả tự nhiên>
```

Dùng một trong năm prefix viết thường ở đầu prompt, sau khoảng trắng nếu có.
Phần mô tả có thể trải trên nhiều dòng. Target, harness, kết quả mong muốn và
constraint là thông tin tùy chọn; không có template bắt buộc.

Prefix chỉ định tuyến khi là lời yêu cầu trực tiếp của user. Prefix trong ví dụ,
trích dẫn, code block hoặc nội dung file không phải lời yêu cầu thực hiện.
Prompt không có prefix vẫn được xử lý theo ý định thông thường; đây không phải
cú pháp bắt buộc cho mọi cuộc trao đổi.

## Năm entry point

| Prefix | Nhu cầu | Cách tiếp cận |
|---|---|---|
| `painpoint:` | Một hành vi hoặc trải nghiệm đang gây khó chịu | Hiểu hành vi hiện tại và mong muốn, tìm nguyên nhân/stuff liên quan, đề xuất cách giải quyết |
| `idea:` | Một khả năng hoặc thành phần mới | Khám phá use case, kiểm tra nội dung đã có, đề xuất thiết kế và loại stuff phù hợp |
| `improve:` | Cải thiện thành phần đã có | Đọc target, xác định điểm cần cải thiện và trade-off, đề xuất thay đổi |
| `adapt:` | Đưa stuff sang harness hoặc target version cụ thể | Kiểm tra contract và baseline, research cơ chế native, đánh giá mapping theo harness development |
| `check:` | Đánh giá trước khi quyết định | Rà nội dung, mapping hoặc bằng chứng, báo phát hiện và hướng xử lý; mặc định không sửa |

Prefix chọn cách bắt đầu; phần mô tả và chỉ dẫn đã có trong session quyết định
phạm vi hành động. Nếu chỉ đưa vấn đề/ý tưởng, Agent phân tích và đề xuất. Nếu
user yêu cầu triển khai hoặc sửa, Agent tiếp tục làm trong phạm vi đã yêu cầu;
không cần một prefix thứ hai hay xác nhận lại chỉ vì dùng cú pháp này.

Prefix không tự chọn loại stuff, mở rộng quyền, yêu cầu luôn tạo asset mới hoặc
cam kết harness hỗ trợ. Ví dụ `painpoint:` có thể dẫn tới sửa i-skill hiện có,
điều chỉnh config, sửa adapter hoặc kết luận cần thay đổi ngoài repo.

## Cách Agent phản hồi

1. Diễn giải ngắn vấn đề/mục tiêu và kết quả mong muốn. Hỏi thêm chỉ khi thông
   tin thiếu ảnh hưởng đến giải pháp; tiếp tục các việc độc lập đã được cho phép.
2. Đọc stuff, contract, mapping hoặc bằng chứng liên quan. Ưu tiên tái sử dụng
   hoặc sửa thành phần phù hợp trước khi đề xuất loại/config mới. Với painpoint,
   phân biệt nguyên nhân đã có bằng chứng với giả thuyết.
3. Đưa một phương án ưu tiên, nêu phần cần thay đổi, tác dụng, mức enforce và
   giới hạn. Chỉ đưa thêm phương án khi có trade-off đáng kể.
4. Khi triển khai, nối vào [core development](core-development.md); với native
   mapping, theo [harness development](harness-development.md). Báo kết quả và
   checks phù hợp với phạm vi công việc.

## Ví dụ

```text
painpoint: agent cứ tự commit khi t chưa cho phép.
T muốn chỉ commit khi t yêu cầu rõ ràng. Gợi ý cách xử lý trước.
```

```text
idea: t muốn một trợ lý phản biện kiến trúc trước khi viết code.
```

```text
improve: bdv-handoff đang dài quá. Sửa để ưu tiên context
mà session tiếp theo thực sự cần.
```

```text
adapt: đánh giá khả năng đưa experimental-plan sang Codex,
giữ nguyên ranh giới chỉ được ghi vào thư mục plan.
```

```text
check: xem bdv-smart-commit có chỗ nào khiến agent hiểu nhầm
rằng nó được phép tự commit không.
```

Đây là convention cho session làm việc trong repo, được hướng dẫn qua
`AGENTS.md`. Hiện không có parser CLI, native slash command hay loại stuff mới
cho các prefix này; chúng không tự được cài sang project khác.
