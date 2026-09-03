// Cùng dạng banner với cảnh báo amber ở admin/knowledge/page.tsx, chỉ đổi màu, thay cho việc mỗi trang tự viết 1 dòng lỗi rời rạc.
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {message}
    </div>
  );
}
