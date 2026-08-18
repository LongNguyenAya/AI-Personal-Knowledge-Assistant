export interface ChartDatum {
  label: string;
  value: number;
}

export interface ChartTrend {
  slope: number;
  futurePoints: number[];
  futureLabels: string[];
  // Dải dự đoán (prediction interval) song song 1-1 với futurePoints — KHÔNG phải confidence
  // interval của đường hồi quy, mà là khoảng có thể xảy ra cho 1 giá trị tương lai cụ thể.
  futureLower: number[];
  futureUpper: number[];
}

// Output thật của tool createChart (backend-service) — frontend-app render trực tiếp từ đây,
// không tự khai lại field nào. Đổi shape ở đây là đổi luôn cả 2 phía cùng lúc.
export interface ChartToolOutput {
  success: true;
  chartType: "bar" | "line" | "pie";
  // "time": các điểm là chuỗi thời gian liên tiếp (dàn đều sát 2 mép hợp lý). "category": các điểm
  // là nhóm rời rạc (breakdown) — dàn đều sát mép sẽ tạo khoảng trống lớn ở giữa khi ít nhóm. Frontend
  // cần biết để chọn đúng cách bố trí trục x.
  xAxisType: "time" | "category";
  data: ChartDatum[];
  empty: boolean;
  emptyReason: "no_data_ever" | "no_recent_activity" | null;
  trend: ChartTrend | null;
  trendMessage: string | null;
  // Đã resolve sẵn label/value — KHÔNG trả về index thô để model tự tra cứu `data[index]`. Model nhỏ
  // như gemini-flash-lite dễ tính sai vị trí khi phải tự suy luận chỉ số trong mảng JSON, dẫn tới
  // nói nhầm thời điểm xảy ra bất thường.
  outliers: ChartDatum[];
  // Song song 1-1 với `data` — chỉ có giá trị khi OLS không đạt ý nghĩa thống kê (trend=null), để
  // vẫn cho user thấy xu hướng gần đây thay vì chỉ nói "chưa rõ ràng" mà không hiện gì thêm.
  movingAverage: number[] | null;
  // Dự đoán "mềm" bằng Holt-linear — chỉ có khi trend=null. Khác `trend` (OLS): KHÔNG có bảo chứng
  // thống kê (không kiểm định t), nhưng vẫn dựa trên công thức toán rõ ràng, tự thích nghi theo xu
  // hướng gần đây thay vì cố fit 1 đường thẳng cho toàn bộ dữ liệu như OLS.
  softForecast: { points: number[]; labels: string[] } | null;
}
