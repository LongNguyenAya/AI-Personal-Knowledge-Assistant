export type DiffSegment = { type: "same" | "removed" | "added"; value: string };

// So khớp theo từng từ bằng LCS, cùng thuật toán "git diff" dùng ở cấp dòng, chỉ hợp chuỗi ngắn vì DP ở đây là O(m*n).
export function wordDiff(oldText: string, newText: string): DiffSegment[] {
  // Giữ lại khoảng trắng làm phần tử riêng để nối lại đúng chỗ cách như văn bản gốc.
  const oldWords = oldText.split(/(\s+)/).filter(Boolean);
  const newWords = newText.split(/(\s+)/).filter(Boolean);
  const m = oldWords.length;
  const n = newWords.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = oldWords[i] === newWords[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const raw: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldWords[i] === newWords[j]) {
      raw.push({ type: "same", value: oldWords[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ type: "removed", value: oldWords[i] });
      i++;
    } else {
      raw.push({ type: "added", value: newWords[j] });
      j++;
    }
  }
  while (i < m) raw.push({ type: "removed", value: oldWords[i++] });
  while (j < n) raw.push({ type: "added", value: newWords[j++] });

  // Gộp các đoạn liền kề cùng loại cho gọn, đỡ tạo quá nhiều <span>.
  const merged: DiffSegment[] = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && last.type === seg.type) last.value += seg.value;
    else merged.push({ ...seg });
  }
  return merged;
}
