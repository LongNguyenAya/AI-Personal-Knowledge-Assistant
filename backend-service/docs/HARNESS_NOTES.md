# Agent harness, ghi chú thiết kế

Tài liệu này giải thích 2 việc: (1) vì sao chỉ 3/10 tool của action-agent được thêm khả năng tự-chẩn-đoán/tự-sửa, không phải toàn bộ; (2) 6 phép đo (eval) hiện có và đo gì (số liệu thật, luôn cập nhật, nằm ở `docs/EVAL_RESULTS.md`).

## Vì sao chỉ 3 tool, không phải cả 10

Nguyên tắc chọn: chỉ đáng thêm vòng lặp tự-sửa ở nơi có **1 phép kiểm tra khách quan, rẻ, tự động được**. Nơi không có phép kiểm tra như vậy thì thêm vòng lặp chỉ tốn thêm chi phí/độ trễ mà không tăng độ tin cậy thật.

| Tool | Có phép kiểm tra khách quan? | Đã xử lý |
|---|---|---|
| `createDiagram` | Có, mã Mermaid parse được hay không là nhị phân, rõ ràng | Tự render-check trước khi chấp nhận, sai thì trả lỗi ngược lại cho model tự sửa, lặp tối đa vài lần trong cùng 1 lượt. Riêng phần "sơ đồ có đúng nội dung tài liệu, không bịa bước" chỉ đo được bằng eval, không chặn được bằng code, thêm eval đo (xem bên dưới) |
| `searchDocuments` | Không có phép kiểm tra "đúng/sai" cho search rỗng, nhưng có 1 nguyên nhân ẩn cần lộ ra | Trả kèm `hasAnyDocuments` để model biết phân biệt "chưa có tài liệu" và "có tài liệu nhưng không liên quan" |
| `listTasks` | Tương tự, không phải "đúng/sai", nhưng nguyên nhân rỗng cần lộ ra | Trả kèm `totalTaskCountIgnoringFilters` khi count=0 |
| `createChart` | Có sẵn từ trước, đã phân biệt `emptyReason: no_data_ever` vs `no_recent_activity` | Phần dữ liệu JSON không cần sửa, đã đúng chuẩn. Phần model có tóm tắt đúng bằng lời hay không chỉ đo được bằng eval, thêm eval đo (xem bên dưới) |
| `readFullDocuments` | Có sẵn từ trước, tự nêu tên chính xác documentId nào lỗi | Không cần sửa |
| `extractActionItems` | Có sẵn từ trước, `isQuoteVerified`/`clampConfidence` tự kiểm tra bằng code | Không cần sửa, chỉ thêm eval đo (xem bên dưới) |
| `createReminder` | Đúng/sai là phép tính giờ, có thể verify | Logic quy đổi giờ đã đúng từ trước, thêm eval đo (xem bên dưới) |
| `createTask`, `listTasks` (khi tạo), `noteObservation`, `proposeKnowledgeNote` | Đúng/sai là **ngữ nghĩa** (tên có đúng ý user không) hoặc **cố tình giao cho con người duyệt** | Không áp dụng tự-sửa bằng code, đây là lý do có "AI Notes" và trang duyệt kiến thức global |

## 6 phép đo (eval), chạy bằng `npm run eval:<tên>` trong `backend-service`

Số liệu thật, luôn cập nhật, nằm ở [`docs/EVAL_RESULTS.md`](./EVAL_RESULTS.md), do chính từng script tự ghi ra mỗi lần chạy, không phải gõ tay. Bảng dưới đây chỉ mô tả từng eval đo gì và chấm bằng cách nào, không lặp lại số liệu để tránh bị lệch với kết quả thật khi code đổi mà quên chạy lại.

| Eval | Đo gì | Cách chấm điểm |
|---|---|---|
| `eval:router` | Orchestrator phân loại đúng route (research/action/both/unknown) không | So với nhãn đúng đã biết trước; câu hỏi cho phần research **tự sinh động** từ nội dung tài liệu thật qua Gemini, không phải soạn sẵn |
| `eval:grounding` | Route research có bịa thông tin không | Chấm bằng `citedDocumentIds` thật (code kiểm tra), không tin lời model tự khai. 5 câu có đáp án thật + 5 câu chắc chắn không có |
| `eval:quote-verification` | `extractActionItems` có phân biệt đúng deadline thật / ví dụ giả định / mơ hồ không | Tạo 1 tài liệu tạm có cài sẵn cả 3 loại, so `verified`/`confidence` với đáp án đúng biết trước |
| `eval:action-consistency` | `createReminder` quy đổi giờ Việt Nam sang UTC có đúng không khi user nói giờ tương đối | Tính đáp án đúng bằng code (không qua AI), so với `dueAt` model thực sự gửi cho tool, kể cả case dễ tính nhầm ngày (giờ rất sớm sáng mai) |
| `eval:chart-narration` | Câu tóm tắt bằng lời sau `createChart` có đúng khớp với JSON thật không, có bịa mức độ chắc chắn không | AI giám khảo riêng (Groq) chấm TỪNG claim trong câu tóm tắt riêng lẻ (không chấm cả câu là 1 khối), mỗi claim ra 1 trong 3 verdict: đúng / chưa rõ / sai |
| `eval:diagram-grounding` | Sơ đồ `createDiagram` vẽ ra có đúng các bước thật trong tài liệu không, có bịa thêm bước nào không | Tạo 1 tài liệu tạm mô tả đúng 1 quy trình cụ thể, AI giám khảo riêng (Groq) chấm TỪNG bước/nhãn trong sơ đồ riêng lẻ, cùng 3 verdict như trên |

`chart-narration` và `diagram-grounding` chấm theo từng claim/bước riêng lẻ, có verdict "chưa rõ" khi dữ liệu thật sự không đủ để khẳng định đúng hay sai, thay vì ép về 1 trong 2 phe như 4 eval còn lại (mô phỏng đúng cách `judgeActions`/`judgeContext` chấm điểm trong repo mentor).

## Giới hạn đã biết

- Cả 6 eval đều chạy trên **số lượng case nhỏ** (9-15 case research/router, 10 case grounding, 1-3 case mỗi loại còn lại), đủ để phát hiện lỗi rõ ràng, chưa đủ để khẳng định độ tin cậy thống kê chặt như mẫu 24+ case.
- `eval:chart-narration` và `eval:diagram-grounding` chạy trên đúng bộ tools thật của user local, không cố định như 4 eval kia.
- Kết quả không phải lúc nào cũng 100%, và đó là điều nên vậy: chạy 2 lần liên tiếp cùng 1 code có thể ra 2 kết quả khác nhau (model có tính xác suất), khác hẳn unit test bình thường. Case `action-consistency` "2h sáng mai" đã tự chứng minh điều này, có lần đúng tuyệt đối, có lần lệch 1 ngày, dù code tính giờ không đổi gì cả. Đo lại riêng đúng case đó 15 lần liên tiếp thì cả 15 lần đều đúng, nên đây là 1 lần trượt hiếm gặp, không phải lỗi hệ thống. Quyết định: không sửa prompt để chặn riêng case này, chấp nhận là giới hạn đã biết, dựa vào cơ chế "AI Notes" (correction memory) để tự học dần nếu user thật gặp phải.
- Vẫn chưa có eval cho `createTask`/`proposeKnowledgeNote`/`noteObservation` (đúng/sai ở đây là ngữ nghĩa, hoặc cố tình giao cho con người duyệt, khó/không nên chấm bằng code).
- Cả 6 script chạy tay (`npm run eval:*`), chưa gắn vào CI. Sai thì phải tự nhớ chạy lại kiểm tra, không tự động chặn merge như 1 pipeline CI thật.
- `searchDocuments`/`listTasks` mới dừng ở "cho thêm thông tin để model tự quyết định", chưa phải model tự **lặp lại hành động** như `createDiagram`. Nếu 1 lần search/list vẫn cho kết quả model thấy chưa đủ, hiện tại không có cơ chế ép model tự thử lại với tham số khác.
