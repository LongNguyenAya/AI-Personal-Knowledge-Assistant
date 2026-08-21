export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  predict: (x: number) => number;
}

export function linearRegression(points: { x: number; y: number }[]): RegressionResult {
  if (points.length < 2) {
    throw new Error("linearRegression cần tối thiểu 2 điểm dữ liệu.");
  }
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    // Mọi điểm trùng x — không xảy ra với x=0,1,2... hiện tại, nhưng hàm quảng cáo là thuần/độc
    // lập nên phải tự bảo vệ, không âm thầm trả NaN rồi lan xuống tận toạ độ SVG.
    throw new Error("linearRegression: mọi điểm có cùng x, không thể tính hồi quy.");
  }
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  const predict = (x: number) => intercept + slope * x;

  const meanY = sumY / n;
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - predict(p.x)) ** 2, 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, r2, predict };
}

// Cook's Distance đo mức 1 điểm kéo lệch cả mô hình — bắt được cả ngoại lai làm nghiêng đường hồi
// quy, không chỉ lệch giá trị đơn thuần. Một mình vẫn có thể báo nhầm dao động bình thường ở n nhỏ,
// nên phải đi kèm điều kiện phần dư chuẩn hoá, và chỉ loại tối đa 1 điểm/lượt.
export function findOutliers(points: { x: number; y: number }[], reg: RegressionResult): number[] {
  const n = points.length;
  const p = 2; // số tham số của mô hình: slope + intercept
  const meanX = points.reduce((s, pt) => s + pt.x, 0) / n;
  const ssX = points.reduce((s, pt) => s + (pt.x - meanX) ** 2, 0);
  const residuals = points.map((pt) => pt.y - reg.predict(pt.x));
  const ssRes = residuals.reduce((s, e) => s + e * e, 0);
  const mse = ssRes / (n - p);
  if (mse === 0 || ssX === 0) return []; // khớp hoàn hảo hoặc mọi x trùng nhau — không có gì để so lệch

  const candidates = points.map((pt, i) => {
    const h = 1 / n + (pt.x - meanX) ** 2 / ssX; // leverage
    const cooksD = (residuals[i] ** 2 / (p * mse)) * (h / (1 - h) ** 2);
    const studentized = residuals[i] / Math.sqrt(mse * (1 - h));
    return { i, cooksD, studentized };
  });

  const flagged = candidates.filter((c) => c.cooksD > 4 / n && Math.abs(c.studentized) > 2);
  if (flagged.length === 0) return [];
  const worst = flagged.reduce((a, b) => (b.cooksD > a.cooksD ? b : a));
  return [worst.i];
}

// Kiểm định t cho hệ số góc — thay ngưỡng R² cố định (không neo ý nghĩa thống kê thật với n nhỏ).
// Bảng t tới hạn 2 phía, α=0.05, theo bậc tự do df=n-2.
const T_CRITICAL_95: Record<number, number> = {
  1: 12.71, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306,
  9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 13: 2.16, 14: 2.145, 15: 2.131,
  20: 2.086, 25: 2.06, 30: 2.042,
};

// df không có sẵn trong bảng → lấy mốc GẦN NHẤT NHỎ HƠN df (không phải luôn fallback về 30).
// Mốc nhỏ hơn ứng với t tới hạn CAO hơn (bảo thủ hơn, đúng hướng an toàn).
// Export riêng để unit test được trực tiếp, không phải lồng qua isSlopeSignificant.
export function tCritical(df: number): number {
  const keys = Object.keys(T_CRITICAL_95).map(Number).sort((a, b) => a - b);
  const nearest = keys.filter((k) => k <= df).pop() ?? keys[0];
  return T_CRITICAL_95[nearest];
}

// Dùng khi OLS không đủ ý nghĩa thống kê để khẳng định xu hướng — không có đường thẳng nào đáng
// tin, nhưng vẫn có thể cho user thấy xu hướng GẦN ĐÂY qua đường trung bình trượt, thay vì chỉ nói
// "chưa rõ ràng" mà không hiện gì thêm. windowSize nhỏ (3) cho phản ứng nhanh với vài kỳ gần nhất,
// hợp với chuỗi ngắn/dao động mạnh (đúng loại dữ liệu khiến OLS không đạt ý nghĩa thống kê).
export function movingAverage(points: { x: number; y: number }[], windowSize = 3): number[] {
  return points.map((_, i) => {
    const window = points.slice(Math.max(0, i - windowSize + 1), i + 1);
    return window.reduce((sum, p) => sum + p.y, 0) / window.length;
  });
}

// Holt-linear (double exponential smoothing) — khác OLS ở chỗ KHÔNG cố fit 1 đường thẳng duy nhất
// cho toàn bộ dữ liệu, mà tự thích nghi theo xu hướng GẦN ĐÂY qua từng bước (mức L và độ dốc T
// được cập nhật dần). Dùng làm dự đoán "mềm" khi OLS không đủ ý nghĩa thống kê — moving average chỉ
// làm mượt dữ liệu ĐÃ CÓ, không dự đoán được tương lai; Holt-linear thì dự đoán được, có công thức
// toán rõ ràng, nhưng KHÔNG có bảo chứng thống kê (không kiểm định t) như OLS.
// alpha/beta là giá trị mặc định hợp lý, không "tối ưu" theo từng dữ liệu cụ thể (cần thêm thuật
// toán dò tham số riêng, không cần thiết ở quy mô này) — alpha cao hơn beta vì MỨC hiện tại nên
// nhạy với dữ liệu mới, còn XU HƯỚNG nên mượt/ổn định hơn từng điểm riêng lẻ.
export function holtLinear(
  points: { x: number; y: number }[],
  alpha = 0.4,
  beta = 0.2
): { level: number; trend: number; forecast: (stepsAhead: number) => number } {
  if (points.length < 2) {
    throw new Error("holtLinear cần tối thiểu 2 điểm dữ liệu.");
  }
  const sorted = [...points].sort((a, b) => a.x - b.x);

  let level = sorted[0].y;
  let trend = sorted[1].y - sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const prevLevel = level;
    level = alpha * sorted[i].y + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  return { level, trend, forecast: (stepsAhead: number) => level + stepsAhead * trend };
}

// Độ rộng dải dự đoán (margin) cho 1 điểm MỚI tại x0 — PREDICTION interval cho 1 giá trị tương lai
// cụ thể, KHÁC với confidence interval của chính đường hồi quy (prediction interval luôn rộng hơn,
// vì cộng thêm cả nhiễu tự nhiên của dữ liệu quanh đường, không chỉ độ không chắc của đường thẳng).
// Không tái dùng `se` trong isSlopeSignificant (đó là sai số CỦA ĐỘ DỐC, phục vụ mục đích khác) —
// tính riêng MSE (sai số dự đoán) rồi ghép công thức chuẩn OLS. Dùng lại đúng tCritical() đã có,
// không cần bảng số liệu mới.
export function predictionMargin(reg: RegressionResult, points: { x: number; y: number }[], x0: number): number {
  const n = points.length;
  const df = n - 2;
  if (df < 1) return 0;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const ssX = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
  if (ssX === 0) return 0;
  const ssRes = points.reduce((s, p) => s + (p.y - reg.predict(p.x)) ** 2, 0);
  const mse = ssRes / df;
  const factor = Math.sqrt(1 + 1 / n + (x0 - meanX) ** 2 / ssX);
  return tCritical(df) * Math.sqrt(mse) * factor;
}

export function isSlopeSignificant(reg: RegressionResult, points: { x: number; y: number }[]): boolean {
  const n = points.length;
  const df = n - 2;
  if (df < 1) return false;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const ssX = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - reg.predict(p.x)) ** 2, 0);
  const se = Math.sqrt(ssRes / df / ssX);
  // ssRes = 0 nghĩa là khớp HOÀN HẢO với mọi điểm — bằng chứng xu hướng rõ ràng nhất có thể có,
  // không phải "không rõ". Chỉ "không có xu hướng" khi khớp hoàn hảo NHƯNG slope = 0 (đường phẳng).
  if (se === 0) return reg.slope !== 0;
  const t = Math.abs(reg.slope / se);
  return t > tCritical(df);
}
