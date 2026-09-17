# Eval Results

Mỗi mục dưới đây do chính script eval tự ghi ra khi chạy, không phải gõ tay.

<!-- eval:router:start -->
### Orchestrator router accuracy

_Cập nhật lần cuối: 2026-09-16, chạy bằng `npm run eval:router`._

Route đúng: 9/9 (100.0%). Trích đúng tài liệu: 6/6 (100.0%). Câu hỏi cho phần research được Gemini tự sinh động từ tài liệu thật của user `ayamihiroshi2108@gmail.com`, không cố định.

| Câu hỏi | Route mong đợi | Route thật | Route | Trích tài liệu |
|---|---|---|---|---|
| Nhánh hotfix được tạo ra từ nhánh nào và dùng để làm gì | research | research | OK | OK |
| Loại năng lượng nào đang dẫn dắt tăng trưởng công suất mới ở Việt Nam? | research | research | OK | OK |
| Ai được xem là lập trình viên đầu tiên trong lịch sử theo tài liệu này | research | research | OK | OK |
| Chạy Lambda container mất bao nhiêu tiền mỗi tháng nếu vẫn nằm trong hạn mức miễn phí | research | research | OK | OK |
| Bao giờ thì đội phải hoàn thành thiết kế UI? | research | research | OK | OK |
| Tạo nhắc nhở họp lúc 18h tối mai | action | action | OK | - |
| Đánh dấu task 'dọn bàn làm việc' là đã xong | action | action | OK | - |
| Vẽ biểu đồ số task hoàn thành theo tuần gần đây | action | action | OK | - |
| Xem tài liệu "ghi-chu-quy-trinh-git.md" và tạo nhắc nhở nếu có deadline nào sắp tới | both | both | OK | OK |

<!-- eval:router:end -->

<!-- eval:grounding:start -->
### Research route grounding

_Cập nhật lần cuối: 2026-09-16, chạy bằng `npm run eval:grounding`._

Độ chính xác grounding: 9/10 (90.0%). 5 câu có đáp án thật (từ trace Langfuse) + 5 câu chắc chắn không có tài liệu liên quan, case cố định trong `data/eval-grounding-cases.json`.

| Câu hỏi | Loại | citedDocumentIds | Kết quả |
|---|---|---|---|
| định luật Moore nói gì về số transistor trên 1 con chip? | có info | fabf8eba-720d-4af6-baa2-6e82f43ef687 | OK |
| deadline hoàn thành thiết kế UI trong sprint 3 là ngày nào? | có info | 54fb69b6-68e6-41b5-a1df-2c042456dde9 | OK |
| quy tắc đặt tên nhánh feature trong quy trình git là gì? | có info | LỖI | SAI |
| trong Dockerfile deploy AWS, dòng nào COPY khác biệt so với phần còn lại? | có info | b517c60e-4785-42b3-acd3-9507b5644d8f | OK |
| tài liệu năng lượng tái tạo nói gì về hiện trạng chuyển dịch xanh ở Việt Nam? | có info | 68990572-7095-43aa-9523-818ea4160cbf | OK |
| công thức nấu phở bò truyền thống là gì? | không có info | rỗng | OK |
| giá cổ phiếu Apple hôm nay bao nhiêu? | không có info | rỗng | OK |
| cách nuôi cá cảnh tại nhà cho người mới bắt đầu? | không có info | rỗng | OK |
| sao Hỏa được hình thành như thế nào? | không có info | rỗng | OK |
| quy định nghỉ phép năm của công ty là gì? | không có info | rỗng | OK |

**Case/claim cần chú ý:**
- "quy tắc đặt tên nhánh feature trong quy trình git là gì?", LỖI: Failed after 3 attempts. Last error: AI_APICallError: You exceeded your current quota, please check 

<!-- eval:grounding:end -->

<!-- eval:quote-verification:start -->
### extractActionItems quote verification

_Cập nhật lần cuối: 2026-09-16, chạy bằng `npm run eval:quote-verification`._

Độ chính xác quote-verification: 3/3. Tài liệu tạm cài sẵn 3 tình huống (deadline thật, deadline thật kèm giờ, deadline giả định), chạy trực tiếp qua tool thật, không mock.

| Tình huống | Mong đợi | Thực tế | Kết quả |
|---|---|---|---|
| deadline thật, ngày rõ ràng | verified=true/confidence=confident | verified=true/confidence=confident | OK |
| deadline thật, có cả ngày lẫn giờ | verified=true/confidence=confident | verified=true/confidence=confident | OK |
| chỉ là VÍ DỤ minh hoạ, không phải cam kết thật | verified=true/confidence=needs_review | verified=true/confidence=needs_review | OK |

<!-- eval:quote-verification:end -->

<!-- eval:action-consistency:start -->
### createReminder time-zone consistency

_Cập nhật lần cuối: 2026-09-16, chạy bằng `npm run eval:action-consistency`._

Độ chính xác quy đổi giờ: 2/3. Đáp án đúng tính bằng code (cộng/trừ UTC+7), không qua AI, kể cả case biên giờ rất sớm sáng mai (dễ tính nhầm ngày UTC).

| Câu nói | Ghi chú | Mong đợi (UTC) | Thực tế (UTC) | Kết quả |
|---|---|---|---|---|
| nhắc tôi 9h sáng mai kiểm tra email | giờ mai, không qua nửa đêm UTC | 2026-09-17T02:00:00.000Z | 2026-09-17T02:00:00.000Z | OK |
| nhắc tôi lúc 23h tối nay hoàn thành báo cáo | giờ hôm nay, muộn | 2026-09-16T16:00:00.000Z | 2026-09-16T16:00:00.000Z | OK |
| nhắc tôi lúc 2h sáng mai đi lấy hàng | giờ mai nhưng rất sớm, dễ tính nhầm ngày UTC | 2026-09-16T19:00:00.000Z | 2026-09-17T19:00:00.000Z | SAI |

**Case/claim cần chú ý:**
- "nhắc tôi lúc 2h sáng mai đi lấy hàng", mong đợi 2026-09-16T19:00:00.000Z, thực tế 2026-09-17T19:00:00.000Z (lệch 1440 phút)

<!-- eval:action-consistency:end -->

<!-- eval:chart-narration:start -->
### Chart narration grounding

_Cập nhật lần cuối: 2026-09-16, chạy bằng `npm run eval:chart-narration`._

Case không có claim sai: 3/3. Claim: 8 đúng / 1 chưa rõ / 0 sai (tổng 9).

| Câu hỏi | Claim (đúng/chưa rõ/sai) |
|---|---|
| Biểu đồ số task hoàn thành theo tuần gần đây | 4s/0?/0x |
| Thống kê số tài liệu tôi đã tải lên | 1s/1?/0x |
| Tỷ lệ hoàn thành task theo trạng thái | 3s/0?/0x |

<!-- eval:chart-narration:end -->

<!-- eval:diagram-grounding:start -->
### Diagram grounding

_Cập nhật lần cuối: 2026-09-16, chạy bằng `npm run eval:diagram-grounding`._

Bước trong sơ đồ: 7 có căn cứ / 0 chưa rõ / 0 bịa thêm (tổng 7). Không có bước nào bịa thêm.

| Bước trong sơ đồ | Verdict | Lý do |
|---|---|---|
| Nhân viên gửi đơn nghỉ phép qua hệ thống nội bộ | grounded | Source explicitly states: "Nhân viên gửi đơn nghỉ phép qua hệ thống nội bộ, ghi rõ ngày bắt đầu và ngày kết thúc." |
| Quản lý trực tiếp xem xét đơn trong vòng 2 ngày làm việc | grounded | Source explicitly states: "Quản lý trực tiếp xem xét đơn trong vòng 2 ngày làm việc." |
| Chuyển sang phòng nhân sự kiểm tra số ngày phép còn lại | grounded | Source explicitly states: "đơn được chuyển sang phòng nhân sự để kiểm tra số ngày phép còn lại." |
| Phòng nhân sự phê duyệt cuối cùng và gửi email xác nhận | grounded | Source explicitly states: "Phòng nhân sự phê duyệt cuối cùng và gửi email xác nhận cho nhân viên." |
| Đơn bị huỷ ngay | grounded | Source explicitly states: "Nếu quản lý từ chối ở bước 2, đơn bị huỷ ngay" |
| Đồng ý | grounded | Source explicitly states: "Nếu quản lý đồng ý, đơn được chuyển sang phòng nhân sự ..." |
| Từ chối | grounded | Source explicitly states: "Nếu quản lý từ chối ..." |

<!-- eval:diagram-grounding:end -->
