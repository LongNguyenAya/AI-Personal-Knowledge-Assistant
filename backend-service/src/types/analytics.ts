export type BreakdownRow = { label: string; value: number };
export type TimeSeriesRow = { label: string; periodStart: string; value: number };

// Đơn vị thời gian cho biểu đồ, không fix cứng để user hỏi gì cũng ra được.
export type Granularity = "hour" | "day" | "week" | "month" | "quarter" | "year";

export interface GranularityConfig {
  // interval literal của Postgres không hiểu "quarter", quy đổi thành 3 tháng khi cần dựng động.
  intervalAmount: number;
  intervalUnit: "hour" | "day" | "week" | "month" | "year";
  labelFormat: string;
  defaultCount: number;
}

export interface SeriesOptions {
  count?: number;
  // Khoảng thời gian tường minh, có thì ưu tiên dùng thay vì lấy N kỳ gần nhất từ hiện tại.
  from?: Date;
  to?: Date;
}
