import type { TaskListItem } from "@ai-assistant/shared-types";

interface TaskListBlockProps {
  tasks?: TaskListItem[];
  count?: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Doesn't rely on the AI listing task names in words since it's prone to summarizing incompletely/incorrectly, shows the real tool data directly like ChartBlock.
export function TaskListBlock({ tasks, count }: TaskListBlockProps) {
  if (!tasks || tasks.length === 0) {
    return <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">No tasks matched the request.</p>;
  }

  return (
    <div className="mt-1">
      <ul className="space-y-1">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-start gap-2 text-sm">
            <span className={t.isDone ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}>
              {t.isDone ? "[Done]" : "[Not done]"}
            </span>
            <span className="flex-1">
              {t.title}
              <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
                {t.isDone ? `completed ${formatDate(t.updatedAt)}` : `created ${formatDate(t.createdAt)}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {count !== undefined && count !== tasks.length ? (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{count} tasks total.</p>
      ) : null}
    </div>
  );
}
