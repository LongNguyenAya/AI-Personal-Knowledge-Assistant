import type { RegressionResult } from "../types/linear-regression";

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
