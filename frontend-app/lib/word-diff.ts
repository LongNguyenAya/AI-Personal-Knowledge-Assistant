export type DiffSegment = { type: "same" | "removed" | "added"; value: string };

// Matches word by word using LCS, the same algorithm "git diff" uses at the line level, only suited to short strings since the DP here is O(m*n).
export function wordDiff(oldText: string, newText: string): DiffSegment[] {
  // Keeps whitespace as its own element so it can be rejoined with the original spacing intact.
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

  // Merges adjacent segments of the same type to keep it compact, avoiding creating too many <span>s.
  const merged: DiffSegment[] = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && last.type === seg.type) last.value += seg.value;
    else merged.push({ ...seg });
  }
  return merged;
}
