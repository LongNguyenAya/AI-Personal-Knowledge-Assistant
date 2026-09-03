"use client";
import { useState } from "react";

const TOOL_LABELS: Record<string, string> = {
  retrieveRelevantChunks: "Tìm kiếm trong tài liệu",
  submitAnswer: "Gửi câu trả lời",
  searchDocuments: "Tìm kiếm trong tài liệu",
  readFullDocuments: "Đọc toàn bộ tài liệu",
  extractActionItems: "Trích xuất việc cần làm",
  createTask: "Tạo task",
  createReminder: "Tạo reminder",
  createChart: "Vẽ biểu đồ",
  createDiagram: "Vẽ sơ đồ",
  listTasks: "Liệt kê task",
  proposeKnowledgeNote: "Đề xuất ghi chú kiến thức",
};

// Ngưỡng thu gọn áp cho từng chuỗi text riêng lẻ, vì 1 tool có thể trả nhiều đoạn dài cần nút thu gọn riêng.
const COLLAPSE_THRESHOLD = 180;

function ExpandableText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (text.length <= COLLAPSE_THRESHOLD) return <span className="whitespace-pre-wrap">{text}</span>;
  return (
    <span>
      <span className="whitespace-pre-wrap">{open ? text : text.slice(0, COLLAPSE_THRESHOLD) + "…"}</span>{" "}
      <button
        onClick={() => setOpen((o) => !o)}
        className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        {open ? "Thu gọn" : "Xem thêm"}
      </button>
    </span>
  );
}

function JsonValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-gray-400 dark:text-gray-600">—</span>;
  if (typeof value === "string") return value === "" ? <span className="text-gray-400 dark:text-gray-600">(rỗng)</span> : <ExpandableText text={value} />;
  if (typeof value === "number" || typeof value === "boolean") return <span>{String(value)}</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-400 dark:text-gray-600">(rỗng)</span>;
    return (
      <div className="flex flex-col gap-1.5">
        {value.map((v, i) => (
          <div key={i} className="rounded-md border border-gray-100 p-1.5 dark:border-gray-800">
            <JsonValue value={v} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-gray-400 dark:text-gray-600">(rỗng)</span>;
    return (
      <div className="flex flex-col gap-1">
        {entries.map(([k, v]) => (
          <div key={k}>
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{k}: </span>
            <JsonValue value={v} />
          </div>
        ))}
      </div>
    );
  }

  return <span>{String(value)}</span>;
}

function isEmptyInput(input: unknown): boolean {
  return input === undefined || (typeof input === "object" && input !== null && Object.keys(input).length === 0);
}

// createChart/listTasks đã có khối UI riêng đẹp hơn, dump lại object kỹ thuật ở đây chỉ gây rối, vẫn hiện Đầu vào bình thường.
const SUMMARIZED_OUTPUT_TOOLS = new Set(["createChart", "listTasks", "createDiagram"]);

export type TraceStep = { toolName: string; input?: unknown; output: unknown };

// Trace "AI đã làm gì" thu gọn mặc định, tin nhắn cũ trước khi có field `input` vẫn hiện được, chỉ thiếu "Đầu vào".
export function TraceBlock({ steps }: { steps: TraceStep[] }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] font-medium text-gray-400 hover:text-indigo-600 dark:text-gray-500 dark:hover:text-indigo-400"
      >
        {open ? "Thu gọn quá trình AI" : `Xem quá trình AI (${steps.length} bước)`}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2.5 text-xs dark:border-gray-800 dark:bg-gray-950/40">
          {steps.map((step, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                {TOOL_LABELS[step.toolName] ?? step.toolName}
              </div>
              {!isEmptyInput(step.input) && (
                <div className="mb-1.5">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-600">Đầu vào</div>
                  <JsonValue value={step.input} />
                </div>
              )}
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-600">Kết quả</div>
                {SUMMARIZED_OUTPUT_TOOLS.has(step.toolName) ? (
                  <span className="text-gray-500 dark:text-gray-400">Đã hiển thị ở trên.</span>
                ) : (
                  <JsonValue value={step.output} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
