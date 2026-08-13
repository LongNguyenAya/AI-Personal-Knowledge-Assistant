import { describe, expect, it } from "vitest";
import { findOutliers, isSlopeSignificant, linearRegression, tCritical } from "./linear-regression";

describe("linearRegression", () => {
  it("throws với ít hơn 2 điểm", () => {
    expect(() => linearRegression([{ x: 0, y: 1 }])).toThrow();
    expect(() => linearRegression([])).toThrow();
  });

  it("throws khi mọi điểm trùng x (mẫu số = 0)", () => {
    expect(() =>
      linearRegression([
        { x: 5, y: 1 },
        { x: 5, y: 2 },
        { x: 5, y: 3 },
      ])
    ).toThrow();
  });

  it("tính đúng slope/intercept/r2 cho đường thẳng hoàn hảo", () => {
    // y = 2x + 1
    const points = [0, 1, 2, 3, 4].map((x) => ({ x, y: 2 * x + 1 }));
    const reg = linearRegression(points);
    expect(reg.slope).toBeCloseTo(2, 6);
    expect(reg.intercept).toBeCloseTo(1, 6);
    expect(reg.r2).toBeCloseTo(1, 6);
    expect(reg.predict(10)).toBeCloseTo(21, 6);
  });
});

describe("tCritical", () => {
  it("lấy đúng mốc bảng cho df có sẵn", () => {
    expect(tCritical(6)).toBe(2.447);
    expect(tCritical(30)).toBe(2.042);
  });

  it("df ngoài bảng lấy mốc GẦN NHẤT NHỎ HƠN (bảo thủ hơn), không nhảy thẳng lên 30", () => {
    // df=16,17,18,19 nằm giữa 15 và 20 trong bảng — phải lấy 15 (2.131), không phải 30 (2.042).
    // Nếu lỡ fallback lên 30, ngưỡng thấp hơn giá trị đúng (2.086 cho df=20) → dễ báo "có ý nghĩa"
    // hơn thực tế.
    expect(tCritical(16)).toBe(2.131);
    expect(tCritical(19)).toBe(2.131);
  });

  it("df nhỏ hơn mọi key trong bảng vẫn trả về giá trị hợp lệ (không throw/NaN)", () => {
    expect(Number.isFinite(tCritical(0))).toBe(true);
  });
});

describe("isSlopeSignificant", () => {
  it("khớp hoàn hảo (ssRes=0) với slope khác 0 → true (bằng chứng xu hướng rõ nhất có thể có)", () => {
    const points = [0, 1, 2, 3, 4].map((x) => ({ x, y: 2 * x + 1 }));
    const reg = linearRegression(points);
    expect(isSlopeSignificant(reg, points)).toBe(true);
  });

  it("đường phẳng hoàn hảo (ssRes=0, slope=0) → false (không có gì để báo là xu hướng)", () => {
    const points = [0, 1, 2, 3, 4].map((x) => ({ x, y: 5 }));
    const reg = linearRegression(points);
    expect(isSlopeSignificant(reg, points)).toBe(false);
  });

  it("xu hướng thật có nhiễu nhỏ → true (tính tay: t≈12.76 >> t tới hạn df=6)", () => {
    const y = [2, 3, 3, 5, 6, 7, 7, 9];
    const points = y.map((value, x) => ({ x, y: value }));
    const reg = linearRegression(points);
    expect(isSlopeSignificant(reg, points)).toBe(true);
  });

  it("dao động không có xu hướng thật → false (tính tay: t≈0.93 < t tới hạn df=6)", () => {
    const y = [5, 3, 6, 4, 5, 7, 4, 6];
    const points = y.map((value, x) => ({ x, y: value }));
    const reg = linearRegression(points);
    expect(isSlopeSignificant(reg, points)).toBe(false);
  });
});

describe("findOutliers", () => {
  it("bắt đúng điểm ngoại lai có đòn bẩy lớn (cuối chuỗi, gấp ~5 lần các điểm còn lại)", () => {
    const y = [4, 4, 4, 4, 4, 4, 4, 20];
    const points = y.map((value, x) => ({ x, y: value }));
    const reg = linearRegression(points);
    expect(findOutliers(points, reg)).toEqual([7]);
  });

  it("KHÔNG báo nhầm dao động bình thường dù Cook's D một mình đã vượt ngưỡng 4/n", () => {
    // cooksD điểm cuối ≈1,28 (> 4/n=0,5) NHƯNG phần dư chuẩn hoá ≈1,90 (< 2) — chỉ đạt 1/2 điều
    // kiện nên không được flag.
    const y = [3, 5, 4, 6, 5, 7, 6, 4];
    const points = y.map((value, x) => ({ x, y: value }));
    const reg = linearRegression(points);
    expect(findOutliers(points, reg)).toEqual([]);
  });

  it("khớp hoàn hảo (mse=0) → không có gì để so lệch, trả về mảng rỗng", () => {
    const points = [0, 1, 2, 3, 4].map((x) => ({ x, y: 2 * x + 1 }));
    const reg = linearRegression(points);
    expect(findOutliers(points, reg)).toEqual([]);
  });
});
