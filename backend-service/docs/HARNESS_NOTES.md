# Agent harness — ghi chú thiết kế

Tài liệu này giải thích 2 việc: (1) vì sao chỉ 3/10 tool của action-agent được thêm khả năng tự-chẩn-đoán/tự-sửa, không phải toàn bộ; (2) 4 phép đo (eval) hiện có, đo gì, và số liệu thật gần nhất.

## Vì sao chỉ 3 tool, không phải cả 10

Nguyên tắc chọn: chỉ đáng thêm vòng lặp tự-sửa ở nơi có **1 phép kiểm tra khách quan, rẻ, tự động được** — nơi không có phép kiểm tra như vậy thì thêm vòng lặp chỉ tốn thêm chi phí/độ trễ mà không tăng độ tin cậy thật.

| Tool | Có phép kiểm tra khách quan? | Đã xử lý |
|---|---|---|
| `createDiagram` | Có — mã Mermaid parse được hay không là nhị phân, rõ ràng | Tự render-check trước khi chấp nhận, sai thì trả lỗi ngược lại cho model tự sửa, lặp tối đa vài lần trong cùng 1 lượt |
| `searchDocuments` | Không có phép kiểm tra "đúng/sai" cho search rỗng, nhưng có 1 nguyên nhân ẩn cần lộ ra | Trả kèm `hasAnyDocuments` để model biết phân biệt "chưa có tài liệu" và "có tài liệu nhưng không liên quan" |
| `listTasks` | Tương tự — không phải "đúng/sai", nhưng nguyên nhân rỗng cần lộ ra | Trả kèm `totalTaskCountIgnoringFilters` khi count=0 |
| `createChart` | Có sẵn từ trước — đã phân biệt `emptyReason: no_data_ever` vs `no_recent_activity` | Không cần sửa, đã đúng chuẩn |
| `readFullDocuments` | Có sẵn từ trước — tự nêu tên chính xác documentId nào lỗi | Không cần sửa |
| `extractActionItems` | Có sẵn từ trước — `isQuoteVerified`/`clampConfidence` tự kiểm tra bằng code | Không cần sửa, chỉ thêm eval đo (xem bên dưới) |
| `createReminder` | Đúng/sai là phép tính giờ, có thể verify | Logic quy đổi giờ đã đúng từ trước, thêm eval đo (xem bên dưới) |
| `createTask`, `listTasks` (khi tạo), `noteObservation`, `proposeKnowledgeNote` | Đúng/sai là **ngữ nghĩa** (tên có đúng ý user không) hoặc **cố tình giao cho con người duyệt** | Không áp dụng tự-sửa bằng code — đây là lý do có "AI Notes" và trang duyệt kiến thức global |

## 4 phép đo (eval) — chạy bằng `npm run eval:<tên>` trong `backend-service`

| Eval | Đo gì | Cách chấm điểm | Kết quả gần nhất |
|---|---|---|---|
| `eval:router` | Orchestrator phân loại đúng route (research/action/both/unknown) không | So với nhãn đúng đã biết trước; câu hỏi cho phần research **tự sinh động** từ nội dung tài liệu thật qua Gemini, không phải soạn sẵn | 9/9 route đúng, 6/6 trích dẫn tài liệu đúng (100%) |
| `eval:grounding` | Route research có bịa thông tin không | Chấm bằng `citedDocumentIds` thật (code kiểm tra), không tin lời model tự khai — 5 câu có đáp án thật + 5 câu chắc chắn không có | 10/10 (100%) |
| `eval:quote-verification` | `extractActionItems` có phân biệt đúng deadline thật / ví dụ giả định / mơ hồ không | Tạo 1 tài liệu tạm có cài sẵn cả 3 loại, so `verified`/`confidence` với đáp án đúng biết trước | 3/3 (100%) |
| `eval:action-consistency` | `createReminder` quy đổi giờ Việt Nam sang UTC có đúng không khi user nói giờ tương đối | Tính đáp án đúng bằng code (không qua AI), so với `dueAt` model thực sự gửi cho tool, kể cả case dễ tính nhầm ngày (giờ rất sớm sáng mai) | 3/3, khớp chính xác tuyệt đối |

## Giới hạn đã biết

- Cả 4 eval đều chạy trên **số lượng case nhỏ** (9-15 case research/router, 10 case grounding, 3 case mỗi loại còn lại) — đủ để phát hiện lỗi rõ ràng, chưa đủ để khẳng định độ tin cậy thống kê chặt như mẫu 24+ case.
- Chưa có eval cho `createChart` (chọn đúng metric/granularity theo câu hỏi) và `createTask`/`proposeKnowledgeNote` (đúng/sai ở đây là ngữ nghĩa, khó chấm bằng code).
- Cả 4 script chạy tay (`npm run eval:*`), chưa gắn vào CI — sai thì phải tự nhớ chạy lại kiểm tra, không tự động chặn merge như 1 pipeline CI thật.
- `searchDocuments`/`listTasks` mới dừng ở "cho thêm thông tin để model tự quyết định", chưa phải model tự **lặp lại hành động** như `createDiagram` — nếu 1 lần search/list vẫn cho kết quả model thấy chưa đủ, hiện tại không có cơ chế ép model tự thử lại với tham số khác.
