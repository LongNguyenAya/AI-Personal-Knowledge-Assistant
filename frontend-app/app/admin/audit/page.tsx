"use client";
import { useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { usePagedFetch } from "@/lib/use-paged-fetch";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PaginationControls } from "@/components/ui/PaginationControls";

type AuditLog = {
  id: string;
  action: string;
  createdAt: string;
  adminName: string | null;
  adminEmail: string | null;
  targetName: string | null;
  targetEmail: string | null;
};

type AuditResponse = { logs: AuditLog[]; total: number; page: number; pageSize: number };

type Category = "all" | "user" | "agent_prompt" | "system_setting" | "knowledge_file";

const TABS: { value: Category; label: string }[] = [
  { value: "all", label: "All" },
  { value: "user", label: "Users" },
  { value: "agent_prompt", label: "Prompt" },
  { value: "system_setting", label: "Setting" },
  { value: "knowledge_file", label: "Knowledge" },
];

const VERB_LABEL: Record<string, string> = {
  lock: "Locked account",
  unlock: "Unlocked account",
  soft_delete: "Soft-deleted account",
  restore: "Restored account",
  approved: "Approved note",
  rejected: "Rejected note",
  revoked: "Revoked note",
};

const CATEGORY_STYLE: Record<string, string> = {
  user: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
  agent_prompt: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  system_setting: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  knowledge_file: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300",
};

// action is stored as "category.verb" or "category.verb:detail", not a separate column, so it's split apart here to display readably.
function parseAction(action: string): { category: string; verb: string; detail: string | null } {
  const [base, detail] = action.split(":");
  const [category, verb] = base.split(".");
  return { category, verb, detail: detail ?? null };
}

function ActionCell({ action }: { action: string }) {
  const { category, verb, detail } = parseAction(action);
  const label = VERB_LABEL[verb] ?? verb;
  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLE[category] ?? "bg-gray-100 text-gray-600"}`}>
        {label}
      </span>
      {detail && category !== "knowledge_file" && (
        <span className="text-xs text-gray-400 dark:text-gray-500">{detail}</span>
      )}
    </div>
  );
}

const PAGE_SIZE = 30;

// This page just reads back admin_audit_log, the table is already written to by 4 other routes, only the display was missing so this page is read-only.
export default function AdminAuditPage() {
  const [category, setCategory] = useState<Category>("all");

  const { page, setPage, data, error, totalPages } = usePagedFetch<AuditLog>(
    async (targetPage) => {
      const qs = category === "all" ? "" : `&category=${category}`;
      const result = await fetchJson<AuditResponse>(`/api/admin/audit?page=${targetPage}&pageSize=${PAGE_SIZE}${qs}`);
      return { items: result.logs, total: result.total, page: result.page, pageSize: result.pageSize };
    },
    [category]
  );

  function switchTab(next: Category) {
    setCategory(next);
    setPage(1);
  }

  const logs = data?.items ?? [];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          History of every state-changing action taken by an admin, locking/unlocking accounts, editing prompts, changing settings, reviewing knowledge.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => switchTab(t.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              category === t.value
                ? "bg-indigo-600 text-white"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} />}

      {data === null && <p className="text-sm text-gray-400 dark:text-gray-500">Loading...</p>}
      {data !== null && logs.length === 0 && (
        <EmptyState title="No actions yet" description="Log entries will appear as soon as an admin performs a state-changing action." />
      )}

      {logs.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400">
              <tr>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Admin</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-5 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {new Date(log.createdAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-gray-900 dark:text-white">{log.adminName ?? "(deleted)"}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{log.adminEmail}</div>
                  </td>
                  <td className="px-5 py-4">
                    <ActionCell action={log.action} />
                  </td>
                  <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                    {log.targetEmail ? (
                      <>
                        <div className="font-medium text-gray-900 dark:text-white">{log.targetName}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">{log.targetEmail}</div>
                      </>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && <PaginationControls page={page} totalPages={totalPages} total={data.total} itemLabel="actions" onPageChange={setPage} />}
    </div>
  );
}
