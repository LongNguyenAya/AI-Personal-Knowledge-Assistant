export type BreakdownRow = { label: string; value: number };
export type TimeSeriesRow = { label: string; periodStart: string; value: number };

// Đơn vị thời gian cho biểu đồ time-series — không fix cứng "theo tuần"/"theo ngày" như bản đầu,
// mà để user hỏi gì cũng ra được (xem giải thích ở agents/tools/create-chart.ts). Đây là toàn bộ
// tập field mà Postgres date_trunc() hỗ trợ và có ý nghĩa thực tế với dữ liệu cá nhân (bỏ qua
// microsecond/millisecond/decade/century/millennium — vô nghĩa với task/reminder/document).
export type Granularity = "hour" | "day" | "week" | "month" | "quarter" | "year";

export interface GranularityConfig {
  // interval literal của Postgres KHÔNG hiểu "quarter" (chỉ date_trunc mới hiểu) — quy đổi quarter
  // thành 3 tháng khi cần dựng interval động.
  intervalAmount: number;
  intervalUnit: "hour" | "day" | "week" | "month" | "year";
  labelFormat: string;
  defaultCount: number;
}

export interface SeriesOptions {
  count?: number;
  // Khoảng thời gian TƯỜNG MINH (vd user hỏi đúng "tháng 7") — khi có cả 2, ưu tiên dùng đúng
  // khoảng này thay vì lấy N kỳ gần nhất tính từ hiện tại.
  from?: Date;
  to?: Date;
}
