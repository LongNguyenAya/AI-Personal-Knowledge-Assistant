import { tool } from "ai";
import { z } from "zod";
import type { ChartToolOutput } from "@ai-assistant/shared-types";
import { findOutliers, isSlopeSignificant, linearRegression } from "../../utils/linear-regression";
import {
  getDocumentStatusBreakdown,
  getDocumentUploadsSeries,
  getReminderCreationSeries,
  getReminderStatusBreakdown,
  getTaskCompletionBreakdown,
  getTaskCompletionSeries,
  hasAnyRecordEver,
} from "../../db/repositories/analytics";
import { TIME_SERIES_METRICS, BREAKDOWN_METRICS, type Metric, type TimeSeriesMetric } from "../../types/chart";
import type { Granularity, TimeSeriesRow } from "../../types/analytics";

const METRIC_DOMAIN: Record<Metric, "task" | "reminder" | "document"> = {
  task_completion: "task",
  task_completion_breakdown: "task",
  reminder_creation: "reminder",
  reminder_status_breakdown: "reminder",
  document_uploads: "document",
  document_status_breakdown: "document",
};

// Khi user không nói rõ đơn vị thời gian, mỗi domain có 1 mặc định hợp lý — model chỉ cần override
// granularity khi câu hỏi có nhắc cụ thể (vd "theo tháng", "theo giờ").
const DEFAULT_GRANULARITY: Record<TimeSeriesMetric, Granularity> = {
  task_completion: "week",
  reminder_creation: "week",
  document_uploads: "day",
};

function fetchTimeSeries(
  userId: string,
  metric: TimeSeriesMetric,
  granularity: Granularity,
  window: { from?: Date; to?: Date }
): Promise<TimeSeriesRow[]> {
  switch (metric) {
    case "task_completion":
      return getTaskCompletionSeries(userId, granularity, window);
    case "reminder_creation":
      return getReminderCreationSeries(userId, granularity, window);
    case "document_uploads":
      return getDocumentUploadsSeries(userId, granularity, window);
  }
}

function fetchBreakdown(userId: string, metric: Exclude<Metric, TimeSeriesMetric>) {
  switch (metric) {
    case "task_completion_breakdown":
      return getTaskCompletionBreakdown(userId);
    case "reminder_status_breakdown":
      return getReminderStatusBreakdown(userId);
    case "document_status_breakdown":
      return getDocumentStatusBreakdown(userId);
  }
}

// Tính nhãn cho các điểm dự đoán tương lai — dùng cùng logic cộng/format với SQL (không parse
// lại chuỗi label đã format vì mỗi granularity format khác nhau, khó parse ngược; dùng periodStart
// dạng ISO chưa format sẵn từ SQL làm điểm xuất phát).
function addPeriod(date: Date, granularity: Granularity, count: number): Date {
  const d = new Date(date);
  switch (granularity) {
    case "hour":
      d.setUTCHours(d.getUTCHours() + count);
      break;
    case "day":
      d.setUTCDate(d.getUTCDate() + count);
      break;
    case "week":
      d.setUTCDate(d.getUTCDate() + count * 7);
      break;
    case "month":
      d.setUTCMonth(d.getUTCMonth() + count);
      break;
    case "quarter":
      d.setUTCMonth(d.getUTCMonth() + count * 3);
      break;
    case "year":
      d.setUTCFullYear(d.getUTCFullYear() + count);
      break;
  }
  return d;
}

function formatPeriodLabel(date: Date, granularity: Granularity): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const day = date.getUTCDate();
  const h = date.getUTCHours();
  switch (granularity) {
    case "hour":
      return `${y}-${pad(m + 1)}-${pad(day)} ${pad(h)}:00`;
    case "day":
    case "week":
      return `${y}-${pad(m + 1)}-${pad(day)}`;
    case "month":
      return `${y}-${pad(m + 1)}`;
    case "quarter":
      return `${y} Q${Math.floor(m / 3) + 1}`;
    case "year":
      return `${y}`;
  }
}

function buildFutureLabels(lastPeriodStart: string, count: number, granularity: Granularity): string[] {
  // periodStart từ SQL dạng "YYYY-MM-DDTHH:MM:SS" (không hậu tố Z) — thêm Z để Date parse được,
  // chỉ dùng nội bộ cho phép cộng/trừ nhất quán, không phải quy đổi timezone thật.
  const last = new Date(`${lastPeriodStart}Z`);
  return Array.from({ length: count }, (_, k) => formatPeriodLabel(addPeriod(last, granularity, k + 1), granularity));
}

export function createChartTool(userId: string) {
  return tool({
    description:
      "Vẽ biểu đồ dựa trên dữ liệu thật của user (task, reminder, tài liệu). Tự query DB và tính toán — không tự bịa số liệu.",
    inputSchema: z.object({
      metric: z.enum([...TIME_SERIES_METRICS, ...BREAKDOWN_METRICS]).describe(
        "Loại dữ liệu cần vẽ. Dùng task_completion/reminder_creation/document_uploads khi user hỏi xu hướng/thay đổi theo thời gian; dùng *_breakdown khi user hỏi phân bổ/tỷ lệ hiện tại."
      ),
      granularity: z
        .enum(["hour", "day", "week", "month", "quarter", "year"])
        .optional()
        .describe(
          "Đơn vị thời gian (kích thước từng cột/điểm), CHỈ áp dụng cho metric time-series (task_completion/reminder_creation/document_uploads). Suy ra từ câu hỏi user (vd 'theo tháng' → month, 'theo giờ' → hour). Bỏ trống nếu user không nói rõ hoặc metric là *_breakdown."
        ),
      from: z
        .string()
        .optional()
        .describe(
          "Mốc bắt đầu khoảng thời gian CỤ THỂ user hỏi (vd user hỏi 'tháng 7' → đầu tháng 7), ISO 8601. CHỈ điền khi user hỏi về 1 khoảng thời gian đã xác định rõ ràng — nếu user chỉ hỏi 'gần đây'/'xu hướng' chung chung không nói rõ mốc, để trống cả from lẫn to để tự lấy N kỳ gần nhất."
        ),
      to: z.string().optional().describe("Mốc kết thúc khoảng thời gian, ISO 8601, đi kèm với from (phải điền cả 2 hoặc để trống cả 2)."),
      chartType: z
        .enum(["bar", "pie"])
        .optional()
        .describe(
          "CHỈ áp dụng cho metric *_breakdown (phân bổ theo nhóm) — bar hoặc pie tuỳ ý. Bỏ trống nếu metric là time-series (task_completion/reminder_creation/document_uploads): nhóm đó LUÔN vẽ line, không cho chọn loại khác — biểu đồ theo thời gian nối các điểm bằng đường mới thể hiện đúng xu hướng, cột chỉ nhấn mạnh từng điểm rời rạc, gây khó đọc xu hướng."
        ),
    }),
    execute: async ({ metric, granularity, from, to, chartType }): Promise<ChartToolOutput> => {
      const isTimeSeries = (TIME_SERIES_METRICS as readonly string[]).includes(metric);
      // Time-series LUÔN vẽ line — không để model tự chọn, vì model chọn không ổn định (cùng loại
      // dữ liệu lúc ra bar lúc ra line dù prompt đã ghi rõ). Bar chỉ hợp lý cho breakdown (nhóm rời
      // rạc, không có khái niệm "xu hướng" để đường line thể hiện).
      const resolvedChartType = isTimeSeries ? "line" : (chartType ?? "bar");
      const parsedFrom = from ? new Date(from) : undefined;
      const parsedTo = to ? new Date(to) : undefined;

      let data: { label: string; value: number }[];
      let resolvedGranularity: Granularity | null = null;
      let lastPeriodStart: string | null = null;

      if (isTimeSeries) {
        resolvedGranularity = granularity ?? DEFAULT_GRANULARITY[metric as TimeSeriesMetric];
        const rows = await fetchTimeSeries(userId, metric as TimeSeriesMetric, resolvedGranularity, {
          from: parsedFrom,
          to: parsedTo,
        });
        lastPeriodStart = rows.length > 0 ? rows[rows.length - 1].periodStart : null;
        data = rows.map((r) => ({ label: r.label, value: r.value }));
      } else {
        data = await fetchBreakdown(userId, metric as Exclude<Metric, TimeSeriesMetric>);
      }

      const base: ChartToolOutput = {
        success: true,
        chartType: resolvedChartType,
        xAxisType: isTimeSeries ? "time" : "category",
        data,
        empty: false,
        emptyReason: null,
        trend: null,
        trendMessage: null,
        outliers: [],
      };

      // KHÔNG kiểm tra data.length === 0 — sau zero-fill, độ dài mảng không bao giờ còn bằng 0
      // nữa dù dữ liệu thật trống trơn. Phải kiểm tra TOÀN BỘ giá trị = 0.
      const hasAnyData = data.some((r) => r.value > 0);
      if (!hasAnyData) {
        const emptyReason = isTimeSeries
          ? (await hasAnyRecordEver(userId, METRIC_DOMAIN[metric])) ? "no_recent_activity" : "no_data_ever"
          : "no_data_ever";
        return { ...base, empty: true, emptyReason };
      }

      if (isTimeSeries && resolvedGranularity && lastPeriodStart && data.length >= 3) {
        const points = data.map((r, i) => ({ x: i, y: r.value }));
        const initialReg = linearRegression(points);
        const outlierIdx = findOutliers(points, initialReg);

        // Loại điểm ngoại lai TRƯỚC KHI tính hồi quy dùng để dự đoán — nếu không, cảnh báo có
        // nhưng đường dự đoán vẫn bị chính điểm đó bẻ cong. Biểu đồ vẫn hiện đủ `data` gốc.
        const cleanPoints = points.filter((_, i) => !outlierIdx.includes(i));
        const usablePoints = cleanPoints.length >= 3 ? cleanPoints : points;
        const reg = cleanPoints.length >= 3 ? linearRegression(cleanPoints) : initialReg;
        const outliers = outlierIdx.map((i) => ({ label: data[i].label, value: data[i].value }));

        if (isSlopeSignificant(reg, usablePoints)) {
          const futurePoints = [1, 2].map((k) => Math.max(0, reg.predict(points.length - 1 + k)));
          const futureLabels = buildFutureLabels(lastPeriodStart, 2, resolvedGranularity);
          return { ...base, trend: { slope: reg.slope, futurePoints, futureLabels }, outliers };
        }
        return { ...base, trendMessage: "Xu hướng chưa rõ ràng", outliers };
      }

      return base;
    },
  });
}
