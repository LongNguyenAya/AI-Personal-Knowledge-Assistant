// Shared writer so every eval script updates its own section of docs/EVAL_RESULTS.md instead of
// results only living in terminal output that someone has to copy into HARNESS_NOTES.md by hand.
// Each script owns 1 section, marked by an HTML-comment pair keyed on its name, so re-running 1
// script only replaces that section and never touches the others (same "1 script, 1 doc section"
// idea as scripts/eval.ts / eval-reports.ts writing docs/EVAL_RESULTS.md / REPORT_EVAL.md in the
// mentor repo, adapted to 1 shared file since there are 6 small evals here instead of 2 large ones).
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const REPORT_PATH = join(__dirname, "../../docs/EVAL_RESULTS.md");

export interface EvalReportSection {
  title: string;
  summary: string;
  table?: { headers: string[]; rows: string[] };
  notes?: string[];
}

function renderSection(name: string, section: EvalReportSection): string {
  const start = `<!-- eval:${name}:start -->`;
  const end = `<!-- eval:${name}:end -->`;
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [start, `### ${section.title}`, "", `_Cập nhật lần cuối: ${date}, chạy bằng \`npm run eval:${name}\`._`, "", section.summary];
  if (section.table && section.table.rows.length > 0) {
    lines.push("", `| ${section.table.headers.join(" | ")} |`, `|${section.table.headers.map(() => "---").join("|")}|`, ...section.table.rows);
  }
  if (section.notes && section.notes.length > 0) {
    lines.push("", "**Case/claim cần chú ý:**", ...section.notes.map((n) => `- ${n}`));
  }
  lines.push("", end);
  return lines.join("\n");
}

/** Replaces this script's marked section in docs/EVAL_RESULTS.md, or appends it if not present yet. */
export function writeEvalReport(name: string, section: EvalReportSection): void {
  const rendered = renderSection(name, section);
  const start = `<!-- eval:${name}:start -->`;
  const end = `<!-- eval:${name}:end -->`;

  const existing = existsSync(REPORT_PATH) ? readFileSync(REPORT_PATH, "utf-8") : "# Eval Results\n\nMỗi mục dưới đây do chính script eval tự ghi ra khi chạy, không phải gõ tay.\n";

  const startIdx = existing.indexOf(start);
  const endIdx = existing.indexOf(end);
  let next: string;
  if (startIdx >= 0 && endIdx >= 0) {
    next = existing.slice(0, startIdx) + rendered + existing.slice(endIdx + end.length);
  } else {
    next = `${existing.trimEnd()}\n\n${rendered}\n`;
  }
  writeFileSync(REPORT_PATH, next);
  console.log(`\nĐã ghi kết quả vào ${REPORT_PATH}`);
}
