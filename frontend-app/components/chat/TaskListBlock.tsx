import type { TaskListItem } from "@ai-assistant/shared-types";

interface TaskListBlockProps {
  tasks?: TaskListItem[];
  count?: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Không dựa vào AI tự liệt kê tên task ra lời — dễ tóm tắt thiếu/sai với model nhỏ khi danh sách
// dài. Hiện thẳng dữ liệu thật từ tool, giống cách ChartBlock hiện số liệu chart trực tiếp.
export function TaskListBlock({ tasks, count }: TaskListBlockProps) {
  if (!tasks || tasks.length === 0) {
    return <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Không tìm thấy task nào khớp yêu cầu.</p>;
  }

  return (
    <div className="mt-1">
      <ul className="space-y-1">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-start gap-2 text-sm">
            <span className={t.isDone ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}>{t.isDone ? "✅" : "⬜"}</span>
            <span className="flex-1">
              {t.title}
              <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
                {t.isDone ? `hoàn thành ${formatDate(t.updatedAt)}` : `tạo ${formatDate(t.createdAt)}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {count !== undefined && count !== tasks.length ? (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Tổng cộng {count} task.</p>
      ) : null}
    </div>
  );
}
