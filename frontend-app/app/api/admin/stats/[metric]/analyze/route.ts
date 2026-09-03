import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { and, desc, eq } from "drizzle-orm";
import { adminChartAnalyses } from "@ai-assistant/db/src/schema";
import { withAdminContext } from "@/lib/with-admin-context";
import { getSeries, getMonthComparison, analyzeSeries } from "@/lib/admin-stats";

const METRIC_CONFIG: Record<
  string,
  { table: "users" | "chat_history"; roleFilterUser: boolean; dbMetric: "signups" | "ai_queries"; label: string }
> = {
  signups: { table: "users", roleFilterUser: false, dbMetric: "signups", label: "user mới tạo tài khoản" },
  "ai-queries": { table: "chat_history", roleFilterUser: true, dbMetric: "ai_queries", label: "lượt hỏi AI" },
};

const VIEW_LABEL: Record<string, string> = {
  week: "7 ngày gần nhất",
  month: "so sánh tháng này với tháng trước",
  year: "12 tháng gần nhất",
};

function isValidView(v: unknown): v is "week" | "month" | "year" {
  return v === "week" || v === "month" || v === "year";
}

// Lấy dòng phân tích mới nhất đã lưu, gọi lúc mount/đổi view để không mất kết quả cũ khi rời trang quay lại.
export const GET = withAdminContext<{ metric: string }>(async (req, { db, params }) => {
  const config = METRIC_CONFIG[params.metric];
  if (!config) return new Response("Metric không hợp lệ", { status: 400 });
  const view = new URL(req.url).searchParams.get("view");
  if (!isValidView(view)) return new Response("view không hợp lệ — dùng week/month/year", { status: 400 });

  const [row] = await db
    .select({ analysisText: adminChartAnalyses.analysisText, createdAt: adminChartAnalyses.createdAt })
    .from(adminChartAnalyses)
    .where(and(eq(adminChartAnalyses.metric, config.dbMetric), eq(adminChartAnalyses.view, view)))
    .orderBy(desc(adminChartAnalyses.createdAt))
    .limit(1);

  return Response.json(row ?? null);
});

// Chỉ chạy khi admin chủ động bấm nút, đây là bước duy nhất gọi AI tốn token thật, luôn INSERT mới để giữ lịch sử.
export const POST = withAdminContext<{ metric: string }>(async (req, { db, session, params }) => {
  const config = METRIC_CONFIG[params.metric];
  if (!config) return new Response("Metric không hợp lệ", { status: 400 });
  const body = await req.json();
  if (!isValidView(body.view)) return new Response("view không hợp lệ — dùng week/month/year", { status: 400 });
  const view = body.view;

  let dataDescription: string;
  if (view === "month") {
    const cmp = await getMonthComparison(db, config.table, config.roleFilterUser);
    dataDescription = `So sánh tháng: tháng này = ${cmp.current}, tháng trước = ${cmp.previous}, thay đổi = ${
      cmp.changePercent === null ? "chưa có dữ liệu tháng trước để so sánh" : `${cmp.changePercent}%`
    }.`;
  } else {
    const granularity = view === "week" ? "day" : "month";
    const count = view === "week" ? 7 : 12;
    const data = await getSeries(db, config.table, granularity, count, config.roleFilterUser);
    const analysis = analyzeSeries(data, granularity);
    dataDescription =
      `Dữ liệu theo thời gian: ${JSON.stringify(data)}.\n` +
      (analysis.trend
        ? `Xu hướng ĐẠT ý nghĩa thống kê (kiểm định t), hệ số góc = ${analysis.trend.slope.toFixed(2)}/kỳ.`
        : `Xu hướng CHƯA đạt ý nghĩa thống kê — không đủ bằng chứng để khẳng định chắc chắn có xu hướng thật.`) +
      (analysis.outliers.length > 0 ? ` Có điểm bất thường (ngoại lai): ${JSON.stringify(analysis.outliers)}.` : "");
  }

  // Trước đây không bọc try/catch nên lỗi Gemini văng thẳng thành 500 trống trơn, giờ bắt lỗi để log chi tiết và trả thông báo dễ hiểu.
  let text: string;
  try {
    const result = await generateText({
      model: google("gemini-flash-lite-latest"),
      prompt:
        `Bạn là trợ lý phân tích dữ liệu cho admin hệ thống. Dưới đây là dữ liệu thống kê về ` +
        `${config.label} trong khoảng thời gian "${VIEW_LABEL[view]}".\n\n${dataDescription}\n\n` +
        `Viết 1 đoạn phân tích ngắn gọn (3-5 câu) bằng tiếng Việt cho admin, nêu rõ xu hướng quan ` +
        `sát được và điểm đáng chú ý (nếu có). PHẢI nói rõ nếu xu hướng CHƯA đạt ý nghĩa thống kê ` +
        `thì đây chỉ là quan sát tham khảo, không dùng giọng chắc chắn như khi đã đạt ý nghĩa thống kê.`,
      telemetry: { functionId: "admin-chart-analysis" },
    });
    text = result.text;
  } catch (err) {
    console.error("[admin-chart-analysis] Lỗi khi gọi Gemini:", err);
    return new Response(
      "Gọi AI thất bại — có thể do hết hạn mức miễn phí tạm thời hoặc thiếu cấu hình API key, vui lòng thử lại sau.",
      { status: 502 }
    );
  }

  const [inserted] = await db
    .insert(adminChartAnalyses)
    .values({ metric: config.dbMetric, view, analysisText: text, generatedBy: session.user.id })
    .returning({ analysisText: adminChartAnalyses.analysisText, createdAt: adminChartAnalyses.createdAt });

  return Response.json(inserted);
});
