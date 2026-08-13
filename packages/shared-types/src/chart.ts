export interface ChartDatum {
  label: string;
  value: number;
}

export interface ChartTrend {
  slope: number;
  futurePoints: number[];
  futureLabels: string[];
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
}
