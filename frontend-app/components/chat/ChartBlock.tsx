import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ChartDatum, ChartTrend } from "@ai-assistant/shared-types";

// Badge pill lấy màu/icon từ số liệu thật (trend.slope hoặc moving average), không suy đoán từ chuỗi trendMessage.
type TrendDirection = "up" | "down" | "flat";

function getTrendDirection(trend: ChartTrend | null, movingAverage: number[] | null): TrendDirection | null {
  if (trend) return trend.slope > 0 ? "up" : trend.slope < 0 ? "down" : "flat";
  if (movingAverage && movingAverage.length >= 2) {
    const delta = movingAverage[movingAverage.length - 1] - movingAverage[0];
    return delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  }
  return null;
}

const TREND_BADGE_STYLE: Record<TrendDirection, { icon: typeof TrendingUp; className: string }> = {
  up: { icon: TrendingUp, className: "bg-green-500/10 text-green-600 border-green-500/30 dark:text-green-400" },
  down: { icon: TrendingDown, className: "bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400" },
  flat: { icon: Minus, className: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700" },
};

function TrendBadge({ direction, message }: { direction: TrendDirection; message: string }) {
  const { icon: Icon, className } = TREND_BADGE_STYLE[direction];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      {message}
    </span>
  );
}

interface ChartBlockProps {
  chartType: "bar" | "line" | "pie";
  xAxisType: "time" | "category";
  data: ChartDatum[];
  trend: ChartTrend | null;
  trendMessage: string | null;
  outliers: ChartDatum[];
  movingAverage: number[] | null;
  softForecast: { points: number[]; labels: string[] } | null;
}

// Props có thể tới từ toolResults cũ lúc shape output createChart còn thiếu xAxisType/outliers, cần giá trị mặc định an toàn.
type LegacyChartBlockProps = Partial<Omit<ChartBlockProps, "chartType" | "data">> & Pick<ChartBlockProps, "chartType" | "data">;

const PIE_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7"];

const WIDTH = 340;
const HEIGHT = 190;
const PAD_LEFT = 34;
const PAD_RIGHT = 14;
const PAD_TOP = 14;
const PAD_BOTTOM = 40;
const MAX_X_LABELS = 8; // quá nhiều điểm (vd granularity="hour" cho 24 điểm) thì bớt nhãn lại, không nhồi hết

function formatValue(value: number): string {
  return Math.round(value).toLocaleString("vi-VN");
}

function BarOrLineChart({ chartType, xAxisType, data, trend, trendMessage, outliers, movingAverage, softForecast }: ChartBlockProps) {
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const isLine = chartType === "line";
  const isCategory = xAxisType === "category";

  const outlierLabels = new Set(outliers.map((o) => o.label));

  // Chỉ time-series mới có điểm dự đoán tương lai, futureLower/futureUpper mặc định [] cho toolResults cũ.
  const futurePoints = isLine && !isCategory ? (trend?.futurePoints ?? []) : [];
  const futureLabels = isLine && !isCategory ? (trend?.futureLabels ?? []) : [];
  const futureLower = isLine && !isCategory ? (trend?.futureLower ?? []) : [];
  const futureUpper = isLine && !isCategory ? (trend?.futureUpper ?? []) : [];
  // softForecast chỉ tồn tại khi trend=null nên không bao giờ hiện cùng futurePoints, nhưng vẫn cộng vào futureCount cho xFor().
  const softForecastPoints = isLine && !isCategory ? (softForecast?.points ?? []) : [];
  const softForecastLabels = isLine && !isCategory ? (softForecast?.labels ?? []) : [];
  const futureCount = futurePoints.length || softForecastPoints.length;

  // "category": chia đều thành băng, mỗi cột nằm chính giữa băng, khác "time" là dàn đều sát 2 mép để chừa chỗ dự đoán.
  let xFor: (index: number) => number;
  if (isCategory) {
    const bandWidth = plotWidth / data.length;
    xFor = (index: number) => PAD_LEFT + bandWidth * (index + 0.5);
  } else {
    const totalSteps = data.length - 1 + futureCount;
    const stepWidth = totalSteps > 0 ? plotWidth / totalSteps : plotWidth;
    xFor = (index: number) => PAD_LEFT + index * stepWidth;
  }

  // futureUpper phải nằm trong allValues, nếu không dải tin cậy có thể bị cắt cụt khi biên trên vượt giá trị lớn nhất.
  const allValues = [...data.map((d) => d.value), ...futurePoints, ...futureUpper, ...softForecastPoints];
  const maxValue = Math.max(...allValues, 1);
  const yFor = (value: number) => PAD_TOP + plotHeight - (value / maxValue) * plotHeight;

  const realPoints = data.map((d, i) => ({ x: xFor(i), y: yFor(d.value) }));
  const futurePointsXY = futurePoints.map((v, k) => ({ x: xFor(data.length + k), y: yFor(v) }));

  const linePath = realPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const dashedPath =
    futurePointsXY.length > 0 && realPoints.length > 0
      ? [realPoints[realPoints.length - 1], ...futurePointsXY].map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
      : null;

  // Dải tin cậy mở rộng dần từ điểm thật cuối cùng (độ rộng=0) ra biên trên/dưới, theo predictionMargin.
  const bandPath =
    isLine && futureCount > 0 && futureLower.length === futureCount && futureUpper.length === futureCount && realPoints.length > 0
      ? (() => {
          const start = realPoints[realPoints.length - 1];
          const upperPts = futureUpper.map((v, k) => ({ x: xFor(data.length + k), y: yFor(v) }));
          const lowerPts = futureLower.map((v, k) => ({ x: xFor(data.length + k), y: yFor(v) }));
          const ring = [start, ...upperPts, ...[...lowerPts].reverse()];
          return ring.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
        })()
      : null;

  // Chỉ có giá trị khi OLS không đạt ý nghĩa thống kê, vẽ thêm đường mượt màu khác để vẫn cho thấy xu hướng gần đây.
  const maPath =
    isLine && movingAverage
      ? data.map((_, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)},${yFor(movingAverage[i]).toFixed(1)}`).join(" ")
      : null;

  // Dự đoán "mềm" bằng Holt-linear chỉ xuất hiện cùng maPath, vẽ nét đứt cam để không nhầm với OLS (nét đứt xanh).
  const softForecastPointsXY = softForecastPoints.map((v, k) => ({ x: xFor(data.length + k), y: yFor(v) }));
  const softForecastPath =
    isLine && softForecastPointsXY.length > 0 && realPoints.length > 0
      ? [realPoints[realPoints.length - 1], ...softForecastPointsXY]
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(" ")
      : null;

  const barWidth = isCategory ? Math.min(60, (plotWidth / data.length) * 0.5) : Math.min(28, (plotWidth / data.length) * 0.6);

  // Thưa bớt nhãn trục x nếu quá nhiều điểm, luôn giữ điểm đầu/cuối, category (thường ít nhóm) luôn hiện đủ.
  const labelStep = isCategory ? 1 : Math.max(1, Math.ceil(data.length / MAX_X_LABELS));
  const labeledIndexes = new Set<number>();
  for (let i = 0; i < data.length; i += labelStep) labeledIndexes.add(i);
  labeledIndexes.add(data.length - 1);

  const yTicks = [0, maxValue / 2, maxValue];

  return (
    <figure className="mt-1">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Biểu đồ dữ liệu"
        className="w-full max-w-sm text-gray-400 dark:text-gray-500"
      >
        {/* lưới + nhãn trục y */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD_LEFT}
              y1={yFor(t)}
              x2={WIDTH - PAD_RIGHT}
              y2={yFor(t)}
              stroke="currentColor"
              strokeWidth={1}
              opacity={t === 0 ? 1 : 0.2}
            />
            <text x={PAD_LEFT - 5} y={yFor(t) + 3} fontSize={8} fill="currentColor" textAnchor="end">
              {formatValue(t)}
            </text>
          </g>
        ))}

        {bandPath && <path d={bandPath} fill="#4f46e5" fillOpacity={0.12} stroke="none" />}
        {isLine && <path className="chart-draw" pathLength={1} d={linePath} fill="none" stroke="#4f46e5" strokeWidth={2} />}
        {isLine &&
          data.map((d, i) => (
            <circle
              key={i}
              cx={realPoints[i].x}
              cy={realPoints[i].y}
              r={outlierLabels.has(d.label) ? 4 : 2.5}
              fill={outlierLabels.has(d.label) ? "#ef4444" : "#4f46e5"}
            />
          ))}
        {/* dashedPath/softForecastPath KHÔNG dùng chart-draw — class đó set stroke-dasharray:1 qua
            CSS (ưu tiên hơn XML strokeDasharray), sẽ đè mất hoa văn nét đứt thật nếu áp dụng chung. */}
        {isLine && dashedPath && <path d={dashedPath} fill="none" stroke="#4f46e5" strokeWidth={2} strokeDasharray="4 3" />}
        {maPath && <path className="chart-draw" pathLength={1} d={maPath} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeOpacity={0.85} />}
        {softForecastPath && <path d={softForecastPath} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3" />}
        {isLine && futurePointsXY.map((p, i) => <circle key={`f${i}`} cx={p.x} cy={p.y} r={2.5} fill="#4f46e5" fillOpacity={0.5} />)}
        {isLine &&
          softForecastPointsXY.map((p, i) => (
            <circle key={`sf${i}`} cx={p.x} cy={p.y} r={2.5} fill="none" stroke="#f59e0b" strokeWidth={1.2} />
          ))}

        {chartType === "bar" &&
          data.map((d, i) => {
            const x = xFor(i) - barWidth / 2;
            const y = yFor(d.value);
            const h = PAD_TOP + plotHeight - y;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={2}
                fill={outlierLabels.has(d.label) ? "#ef4444" : "#4f46e5"}
              />
            );
          })}

        {/* nhãn trục x — chỉ gắn cho dữ liệu THẬT, không bao giờ dùng nhãn dự đoán làm mốc trục */}
        {data.map((d, i) =>
          labeledIndexes.has(i) ? (
            <text
              key={i}
              x={xFor(i)}
              y={PAD_TOP + plotHeight + 12}
              fontSize={8}
              fill="currentColor"
              textAnchor={isCategory ? "middle" : "end"}
              transform={isCategory ? undefined : `rotate(-40 ${xFor(i)} ${PAD_TOP + plotHeight + 12})`}
            >
              {d.label}
            </text>
          ) : null
        )}
      </svg>
      <figcaption className="mt-1 space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
        {trendMessage
          ? (() => {
              const direction = getTrendDirection(trend, movingAverage);
              return direction ? (
                <TrendBadge direction={direction} message={trendMessage} />
              ) : (
                <p>{trendMessage}</p>
              );
            })()
          : null}
        {maPath ? (
          <p>
            <span className="inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: "#f59e0b" }} /> Đường cam liền nét:
            trung bình trượt 3 kỳ gần nhất — chỉ mang tính tham khảo, chưa đủ ý nghĩa thống kê để khẳng định xu hướng.
          </p>
        ) : null}
        {softForecastPath ? (
          <p>
            Dự đoán tham khảo (đường cam nét đứt):{" "}
            {softForecastLabels.map((l, i) => `${l} (~${formatValue(softForecastPoints[i])})`).join(", ")} — dựa trên xu hướng gần đây, KHÔNG
            có bảo chứng thống kê như dự đoán chính thức.
          </p>
        ) : null}
        {futurePoints.length > 0 && (
          <p>
            Dự đoán: {futureLabels.map((l, i) => `${l} (~${formatValue(futurePoints[i])})`).join(", ")}
            {bandPath ? " — vùng tô mờ là khoảng có thể xảy ra, càng xa càng rộng." : ""}
          </p>
        )}
        {outliers.length > 0 ? (
          <p>
            Cảnh báo: {outliers[0].label} có giá trị bất thường ({formatValue(outliers[0].value)}), đã loại khỏi tính toán đường xu hướng.
          </p>
        ) : null}
      </figcaption>
    </figure>
  );
}

function PieChart({ data }: { data: ChartDatum[] }) {
  const cx = 70;
  const cy = 70;
  const r = 60;
  const total = data.reduce((s, d) => s + d.value, 0);
  const nonZero = data.filter((d) => d.value > 0);

  // 1 nhóm chiếm 100% thì góc cung = 360°, path cung tròn suy biến không vẽ ra gì, phải vẽ circle thay vì path.
  const singleSlice = nonZero.length === 1 ? nonZero[0] : null;
  const singleColor = singleSlice ? PIE_COLORS[data.findIndex((d) => d.label === singleSlice.label) % PIE_COLORS.length] : null;

  let cumulativeAngle = -Math.PI / 2;
  const slices = singleSlice
    ? []
    : data.map((d, i) => {
        if (d.value === 0) return null;
        const angle = (d.value / total) * 2 * Math.PI;
        const startAngle = cumulativeAngle;
        const endAngle = cumulativeAngle + angle;
        cumulativeAngle = endAngle;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = angle > Math.PI ? 1 : 0;
        return {
          path: `M ${cx},${cy} L ${x1.toFixed(2)},${y1.toFixed(2)} A ${r},${r} 0 ${largeArc},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`,
          color: PIE_COLORS[i % PIE_COLORS.length],
          label: d.label,
          value: d.value,
        };
      }).filter((s): s is NonNullable<typeof s> => s !== null);

  return (
    <figure className="mt-1">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 140 140" role="img" aria-label="Biểu đồ phân bổ" className="h-32 w-32 flex-shrink-0">
          {singleSlice ? (
            <circle cx={cx} cy={cy} r={r} fill={singleColor ?? PIE_COLORS[0]} />
          ) : (
            slices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)
          )}
        </svg>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {(singleSlice ? [{ label: singleSlice.label, value: singleSlice.value, color: singleColor ?? PIE_COLORS[0] }] : slices).map((s, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}: {formatValue(s.value)}
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

export function ChartBlock({ chartType, xAxisType, data, trend, trendMessage, outliers, movingAverage, softForecast }: LegacyChartBlockProps) {
  if (chartType === "pie") return <PieChart data={data} />;
  return (
    <BarOrLineChart
      chartType={chartType}
      xAxisType={xAxisType ?? "time"}
      data={data}
      trend={trend ?? null}
      trendMessage={trendMessage ?? null}
      outliers={outliers ?? []}
      movingAverage={movingAverage ?? null}
      softForecast={softForecast ?? null}
    />
  );
}
