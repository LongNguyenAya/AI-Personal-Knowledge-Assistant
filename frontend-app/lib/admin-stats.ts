import { sql } from "drizzle-orm";
import { dbAdmin } from "@ai-assistant/db/src/client";
import {
  linearRegression,
  findOutliers,
  isSlopeSignificant,
  movingAverage,
  holtLinear,
  predictionMargin,
} from "@ai-assistant/shared-types";
import type { ChartDatum, ChartTrend } from "@ai-assistant/shared-types";

type Db = typeof dbAdmin;
type Granularity = "day" | "month";

// Cùng kỹ thuật zero-fill với backend-service/db/repositories/analytics.ts, viết lại riêng vì không import được, và không loại trừ kỳ hiện tại.
export async function getSeries(
  db: Db,
  table: "users" | "chat_history",
  granularity: Granularity,
  count: number,
  roleFilterUser = false
): Promise<ChartDatum[]> {
  const labelFormat = granularity === "day" ? "YYYY-MM-DD" : "YYYY-MM";
  const step = sql`(${sql.raw(`interval '1 ${granularity}'`)})`;
  const joinExtra = roleFilterUser ? sql` AND u.role = 'user'` : sql``;
  const rows = await db.execute<{ label: string; value: number }>(sql`
    SELECT
      to_char(gs.period, ${labelFormat}) AS label,
      COALESCE(count(u.id), 0)::int AS value
    FROM generate_series(
      date_trunc(${granularity}, now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - (${count - 1}::int * ${step}),
      date_trunc(${granularity}, now() AT TIME ZONE 'Asia/Ho_Chi_Minh'),
      ${step}
    ) AS gs(period)
    LEFT JOIN ${sql.raw(table)} u ON date_trunc(${granularity}, u.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = gs.period${joinExtra}
    GROUP BY gs.period ORDER BY gs.period
  `);
  return rows.map((r) => ({ label: r.label, value: r.value }));
}

export async function getMonthComparison(
  db: Db,
  table: "users" | "chat_history",
  roleFilterUser = false
): Promise<{ current: number; previous: number; changePercent: number | null }> {
  const roleClause = roleFilterUser ? sql`role = 'user' AND ` : sql``;
  const [[current], [previous]] = await Promise.all([
    db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM ${sql.raw(table)}
      WHERE ${roleClause}date_trunc('month', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')
    `),
    db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM ${sql.raw(table)}
      WHERE ${roleClause}date_trunc('month', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - interval '1 month'
    `),
  ]);
  const changePercent = previous.n === 0 ? null : Math.round(((current.n - previous.n) / previous.n) * 100);
  return { current: current.n, previous: previous.n, changePercent };
}

// Bản rút gọn của buildFutureLabels bên create-chart.ts, chỉ cần 2 granularity (day/month) khớp 2 view có chart.
function addPeriod(label: string, granularity: Granularity, count: number): string {
  if (granularity === "day") {
    const d = new Date(`${label}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + count);
    return d.toISOString().slice(0, 10);
  }
  const [y, m] = label.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + count, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Wiring y hệt nhánh isTimeSeries trong create-chart.ts, trùng lặp có chủ đích, phần toán đã dùng chung qua shared-types.
export function analyzeSeries(
  data: ChartDatum[],
  granularity: Granularity
): {
  trend: ChartTrend | null;
  trendMessage: string | null;
  outliers: ChartDatum[];
  movingAverage: number[] | null;
  softForecast: { points: number[]; labels: string[] } | null;
} {
  if (data.length < 3) {
    return { trend: null, trendMessage: null, outliers: [], movingAverage: null, softForecast: null };
  }

  const points = data.map((r, i) => ({ x: i, y: r.value }));
  const initialReg = linearRegression(points);
  const outlierIdx = findOutliers(points, initialReg);
  const cleanPoints = points.filter((_, i) => !outlierIdx.includes(i));
  const usablePoints = cleanPoints.length >= 3 ? cleanPoints : points;
  const reg = cleanPoints.length >= 3 ? linearRegression(cleanPoints) : initialReg;
  const outliers = outlierIdx.map((i) => ({ label: data[i].label, value: data[i].value }));
  const lastLabel = data[data.length - 1].label;

  if (isSlopeSignificant(reg, usablePoints)) {
    const futureX = [1, 2].map((k) => points.length - 1 + k);
    const futurePoints = futureX.map((x) => Math.max(0, reg.predict(x)));
    const margins = futureX.map((x) => predictionMargin(reg, usablePoints, x));
    const futureLower = futurePoints.map((v, i) => Math.max(0, v - margins[i]));
    const futureUpper = futurePoints.map((v, i) => v + margins[i]);
    const futureLabels = [1, 2].map((k) => addPeriod(lastLabel, granularity, k));
    return {
      trend: { slope: reg.slope, futurePoints, futureLabels, futureLower, futureUpper },
      trendMessage: null,
      outliers,
      movingAverage: null,
      softForecast: null,
    };
  }

  const holt = holtLinear(points);
  const softForecastPoints = [1, 2].map((h) => Math.max(0, holt.forecast(h)));
  const softForecastLabels = [1, 2].map((k) => addPeriod(lastLabel, granularity, k));
  return {
    trend: null,
    trendMessage: "Xu hướng chưa rõ ràng",
    outliers,
    movingAverage: movingAverage(points),
    softForecast: { points: softForecastPoints, labels: softForecastLabels },
  };
}
