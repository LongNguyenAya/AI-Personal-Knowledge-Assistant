export interface ChartDatum {
  label: string;
  value: number;
}

export interface ChartTrend {
  slope: number;
  futurePoints: number[];
  futureLabels: string[];
  // Prediction interval maps 1-1 with futurePoints, not the regression line's confidence interval.
  futureLower: number[];
  futureUpper: number[];
}

// Real output of the createChart tool, frontend-app renders it directly without redeclaring any field.
export interface ChartToolOutput {
  success: true;
  chartType: "bar" | "line" | "pie";
  // "time" spreads flush to both edges, "category" (breakdown) doesn't, to avoid gaps when there are few groups.
  xAxisType: "time" | "category";
  data: ChartDatum[];
  empty: boolean;
  emptyReason: "no_data_ever" | "no_recent_activity" | null;
  trend: ChartTrend | null;
  trendMessage: string | null;
  // label/value already resolved, no raw index returned to avoid the model miscalculating array position.
  outliers: ChartDatum[];
  // Maps 1-1 with `data`, only has a value when OLS hasn't reached statistical significance (trend=null).
  movingAverage: number[] | null;
  // "Soft" forecast via Holt-linear, only present when trend=null, not statistically tested like trend.
  softForecast: { points: number[]; labels: string[] } | null;
}
