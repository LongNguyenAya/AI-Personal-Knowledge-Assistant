export const TIME_SERIES_METRICS = ["task_completion", "reminder_creation", "document_uploads"] as const;
export const BREAKDOWN_METRICS = ["task_completion_breakdown", "reminder_status_breakdown", "document_status_breakdown"] as const;

export type TimeSeriesMetric = (typeof TIME_SERIES_METRICS)[number];
export type Metric = TimeSeriesMetric | (typeof BREAKDOWN_METRICS)[number];
