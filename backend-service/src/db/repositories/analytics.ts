import { documents, reminders, tasks } from "@ai-assistant/db/src/schema";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { withUserContext } from "../context";
import type { BreakdownRow, TimeSeriesRow, Granularity, GranularityConfig, SeriesOptions } from "../../types/analytics";

// The postgres-js driver, execute() returns an array directly, no need for .rows like the node-postgres driver.

const GRANULARITY_CONFIG: Record<Granularity, GranularityConfig> = {
  hour: { intervalAmount: 1, intervalUnit: "hour", labelFormat: "YYYY-MM-DD HH24:00", defaultCount: 24 },
  day: { intervalAmount: 1, intervalUnit: "day", labelFormat: "YYYY-MM-DD", defaultCount: 14 },
  week: { intervalAmount: 1, intervalUnit: "week", labelFormat: "YYYY-MM-DD", defaultCount: 8 },
  month: { intervalAmount: 1, intervalUnit: "month", labelFormat: "YYYY-MM", defaultCount: 6 },
  quarter: { intervalAmount: 3, intervalUnit: "month", labelFormat: 'YYYY "Q"Q', defaultCount: 4 },
  year: { intervalAmount: 1, intervalUnit: "year", labelFormat: "YYYY", defaultCount: 5 },
};

// Builds the interval dynamically without sql.raw, amount/unit are still bound as normal parameters.
function periodInterval(cfg: GranularityConfig): SQL {
  return sql`(${cfg.intervalAmount}::text || ' ' || ${cfg.intervalUnit}::text)::interval`;
}

// Builds the generate_series bounds and date filter condition, shared across all 3 domains.
function resolveSeriesBounds(granularity: Granularity, cfg: GranularityConfig, options: SeriesOptions | undefined, dateColumnSql: SQL) {
  const step = periodInterval(cfg);
  const { from, to, count } = options ?? {};

  if (from && to) {
    // postgres-js doesn't auto-serialize Date when binding through raw sql, has to .toISOString() first.
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    // A range explicitly given by the user is already a fixed past period, no need to exclude the current incomplete period.
    return {
      startExpr: sql`date_trunc(${granularity}, ${fromIso}::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
      stopExpr: sql`date_trunc(${granularity}, ${toIso}::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
      step,
      rangeCondition: sql`${dateColumnSql} >= ${fromIso}::timestamptz AND ${dateColumnSql} <= ${toIso}::timestamptz`,
    };
  }

  const n = count ?? cfg.defaultCount;
  return {
    startExpr: sql`date_trunc(${granularity}, now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - (${n}::int * ${step})`,
    stopExpr: sql`date_trunc(${granularity}, now() AT TIME ZONE 'Asia/Ho_Chi_Minh') - ${step}`,
    step,
    rangeCondition: sql`${dateColumnSql} >= now() - ((${n}::int + 1) * ${step})`,
  };
}

// Tasks have no completedAt, only isDone, so updatedAt is the reliable marker for the most recent completion.
export async function getTaskCompletionSeries(userId: string, granularity: Granularity, options?: SeriesOptions) {
  const cfg = GRANULARITY_CONFIG[granularity];
  const { startExpr, stopExpr, step, rangeCondition } = resolveSeriesBounds(granularity, cfg, options, sql`t.updated_at`);
  return withUserContext(userId, (tx) =>
    tx.execute<TimeSeriesRow>(sql`
      SELECT
        to_char(gs.period, ${cfg.labelFormat}) AS label,
        to_char(gs.period, 'YYYY-MM-DD"T"HH24:MI:SS') AS "periodStart",
        COALESCE(count(t.id), 0)::int AS value
      FROM generate_series(${startExpr}, ${stopExpr}, ${step}) AS gs(period)
      LEFT JOIN tasks t ON date_trunc(${granularity}, t.updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = gs.period
        AND t.user_id = ${userId} AND t.is_done = true AND t.deleted_at IS NULL
        AND ${rangeCondition}
      GROUP BY gs.period ORDER BY gs.period
    `)
  );
}

export async function getReminderCreationSeries(userId: string, granularity: Granularity, options?: SeriesOptions) {
  const cfg = GRANULARITY_CONFIG[granularity];
  const { startExpr, stopExpr, step, rangeCondition } = resolveSeriesBounds(granularity, cfg, options, sql`r.created_at`);
  return withUserContext(userId, (tx) =>
    tx.execute<TimeSeriesRow>(sql`
      SELECT
        to_char(gs.period, ${cfg.labelFormat}) AS label,
        to_char(gs.period, 'YYYY-MM-DD"T"HH24:MI:SS') AS "periodStart",
        COALESCE(count(r.id), 0)::int AS value
      FROM generate_series(${startExpr}, ${stopExpr}, ${step}) AS gs(period)
      LEFT JOIN reminders r ON date_trunc(${granularity}, r.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = gs.period
        AND r.user_id = ${userId}
        AND ${rangeCondition}
      GROUP BY gs.period ORDER BY gs.period
    `)
  );
}

export async function getDocumentUploadsSeries(userId: string, granularity: Granularity, options?: SeriesOptions) {
  const cfg = GRANULARITY_CONFIG[granularity];
  const { startExpr, stopExpr, step, rangeCondition } = resolveSeriesBounds(granularity, cfg, options, sql`d.created_at`);
  return withUserContext(userId, (tx) =>
    tx.execute<TimeSeriesRow>(sql`
      SELECT
        to_char(gs.period, ${cfg.labelFormat}) AS label,
        to_char(gs.period, 'YYYY-MM-DD"T"HH24:MI:SS') AS "periodStart",
        COALESCE(count(d.id), 0)::int AS value
      FROM generate_series(${startExpr}, ${stopExpr}, ${step}) AS gs(period)
      LEFT JOIN documents d ON date_trunc(${granularity}, d.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = gs.period
        AND d.user_id = ${userId}
        AND ${rangeCondition}
      GROUP BY gs.period ORDER BY gs.period
    `)
  );
}

// Breakdown is the current distribution, merged with the real enum so a status with 0 records still shows up.
export async function getTaskCompletionBreakdown(userId: string): Promise<BreakdownRow[]> {
  const rows = await withUserContext(userId, (tx) =>
    tx
      .select({ isDone: tasks.isDone, count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt)))
      .groupBy(tasks.isDone)
  );
  const map = new Map(rows.map((r) => [r.isDone, r.count]));
  return [
    { label: "Hoàn thành", value: map.get(true) ?? 0 },
    { label: "Chưa hoàn thành", value: map.get(false) ?? 0 },
  ];
}

const REMINDER_STATUSES = ["pending", "sent"] as const; // matches reminderStatusEnum in schema.ts

export async function getReminderStatusBreakdown(userId: string): Promise<BreakdownRow[]> {
  const rows = await withUserContext(userId, (tx) =>
    tx
      .select({ status: reminders.status, count: sql<number>`count(*)::int` })
      .from(reminders)
      .where(eq(reminders.userId, userId))
      .groupBy(reminders.status)
  );
  const map = new Map(rows.map((r) => [r.status, r.count]));
  return REMINDER_STATUSES.map((status) => ({ label: status, value: map.get(status) ?? 0 }));
}

const DOCUMENT_STATUSES = ["uploaded", "processing", "processed", "failed"] as const; // matches documentStatusEnum in schema.ts

export async function getDocumentStatusBreakdown(userId: string): Promise<BreakdownRow[]> {
  const rows = await withUserContext(userId, (tx) =>
    tx
      .select({ status: documents.status, count: sql<number>`count(*)::int` })
      .from(documents)
      .where(eq(documents.userId, userId))
      .groupBy(documents.status)
  );
  const map = new Map(rows.map((r) => [r.status, r.count]));
  return DOCUMENT_STATUSES.map((status) => ({ label: status, value: map.get(status) ?? 0 }));
}

// Distinguishes "never had any data" from "no recent activity", only needed for time-series.
export async function hasAnyRecordEver(userId: string, domain: "task" | "reminder" | "document"): Promise<boolean> {
  return withUserContext(userId, async (tx) => {
    if (domain === "task") {
      const [row] = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.isDone, true), isNull(tasks.deletedAt)))
        .limit(1);
      return !!row;
    }
    if (domain === "reminder") {
      const [row] = await tx.select({ id: reminders.id }).from(reminders).where(eq(reminders.userId, userId)).limit(1);
      return !!row;
    }
    const [row] = await tx.select({ id: documents.id }).from(documents).where(eq(documents.userId, userId)).limit(1);
    return !!row;
  });
}
