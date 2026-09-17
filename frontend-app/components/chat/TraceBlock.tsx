"use client";
import { useState } from "react";

const TOOL_LABELS: Record<string, string> = {
  retrieveRelevantChunks: "Search documents",
  submitAnswer: "Submit answer",
  searchDocuments: "Search documents",
  readFullDocuments: "Read full documents",
  extractActionItems: "Extract action items",
  createTask: "Create task",
  createReminder: "Create reminder",
  createChart: "Create chart",
  createDiagram: "Create diagram",
  listTasks: "List tasks",
  proposeKnowledgeNote: "Propose knowledge note",
};

// The collapse threshold applies per individual text string, since 1 tool can return multiple long segments each needing their own collapse button.
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
        {open ? "Collapse" : "Show more"}
      </button>
    </span>
  );
}

function JsonValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-gray-400 dark:text-gray-600">N/A</span>;
  if (typeof value === "string") return value === "" ? <span className="text-gray-400 dark:text-gray-600">(empty)</span> : <ExpandableText text={value} />;
  if (typeof value === "number" || typeof value === "boolean") return <span>{String(value)}</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-400 dark:text-gray-600">(empty)</span>;
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
    if (entries.length === 0) return <span className="text-gray-400 dark:text-gray-600">(empty)</span>;
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

// createChart/listTasks already have their own nicer UI block, dumping the raw technical object here would just be noise, "Input" is still shown normally.
const SUMMARIZED_OUTPUT_TOOLS = new Set(["createChart", "listTasks", "createDiagram"]);

export type TraceStep = { toolName: string; input?: unknown; output: unknown };

// The "What the AI did" trace is collapsed by default, older messages predating the `input` field still render, just missing "Input".
export function TraceBlock({ steps }: { steps: TraceStep[] }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] font-medium text-gray-400 hover:text-indigo-600 dark:text-gray-500 dark:hover:text-indigo-400"
      >
        {open ? "Collapse AI trace" : `View AI trace (${steps.length} steps)`}
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
                  <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-600">Input</div>
                  <JsonValue value={step.input} />
                </div>
              )}
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-600">Output</div>
                {SUMMARIZED_OUTPUT_TOOLS.has(step.toolName) ? (
                  <span className="text-gray-500 dark:text-gray-400">Already shown above.</span>
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
