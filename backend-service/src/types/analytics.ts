export type BreakdownRow = { label: string; value: number };
export type TimeSeriesRow = { label: string; periodStart: string; value: number };

// The time unit for the chart, not hardcoded so it can handle whatever the user asks.
export type Granularity = "hour" | "day" | "week" | "month" | "quarter" | "year";

export interface GranularityConfig {
  // Postgres's interval literal doesn't understand "quarter", converted to 3 months whenever it needs to be built dynamically.
  intervalAmount: number;
  intervalUnit: "hour" | "day" | "week" | "month" | "year";
  labelFormat: string;
  defaultCount: number;
}

export interface SeriesOptions {
  count?: number;
  // An explicit time range, used in preference over taking the N most recent periods from now when present.
  from?: Date;
  to?: Date;
}
