export interface ChartDatum {
  label: string;
  value: number;
}

export interface ChartTrend {
  slope: number;
  futurePoints: number[];
  futureLabels: string[];
  // Prediction interval song song 1-1 với futurePoints, không phải confidence interval của đường hồi quy.
  futureLower: number[];
  futureUpper: number[];
}

// Output thật của tool createChart, frontend-app render trực tiếp không tự khai lại field nào.
export interface ChartToolOutput {
  success: true;
  chartType: "bar" | "line" | "pie";
  // "time" dàn đều sát 2 mép, "category" (breakdown) thì không, để tránh khoảng trống khi ít nhóm.
  xAxisType: "time" | "category";
  data: ChartDatum[];
  empty: boolean;
  emptyReason: "no_data_ever" | "no_recent_activity" | null;
  trend: ChartTrend | null;
  trendMessage: string | null;
  // Đã resolve sẵn label/value, không trả index thô để tránh model tính sai vị trí trong mảng.
  outliers: ChartDatum[];
  // Song song 1-1 với `data`, chỉ có giá trị khi OLS chưa đạt ý nghĩa thống kê (trend=null).
  movingAverage: number[] | null;
  // Dự đoán "mềm" bằng Holt-linear, chỉ có khi trend=null, không kiểm định thống kê như trend.
  softForecast: { points: number[]; labels: string[] } | null;
}
