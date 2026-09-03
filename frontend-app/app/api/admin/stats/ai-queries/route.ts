import { withAdminContext } from "@/lib/with-admin-context";
import { getSeries, getMonthComparison, analyzeSeries } from "@/lib/admin-stats";

// role="user" ở cả getSeries/getMonthComparison đếm số câu hỏi, đếm cả dòng "assistant" trả lời sẽ ra gấp đôi số lượt hỏi thật.
export const GET = withAdminContext(async (req, { db }) => {
  const view = new URL(req.url).searchParams.get("view");

  if (view === "week" || view === "year") {
    const granularity = view === "week" ? "day" : "month";
    const count = view === "week" ? 7 : 12;
    const data = await getSeries(db, "chat_history", granularity, count, true);
    return Response.json({ data, ...analyzeSeries(data, granularity) });
  }

  if (view === "month") return Response.json(await getMonthComparison(db, "chat_history", true));

  return new Response("Invalid view — dùng week/month/year", { status: 400 });
});
