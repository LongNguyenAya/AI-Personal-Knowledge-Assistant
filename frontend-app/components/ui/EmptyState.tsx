// Dùng chung cho mọi danh sách rỗng trong app — viền đứt nét mượn đúng ngôn ngữ hình ảnh đã có ở
// UploadDropzone (nơi đầu tiên áp dụng "khung đứt nét = có thể hành động tiếp"), để trạng thái
// rỗng trông nhất quán thay vì mỗi trang tự viết 1 dòng chữ xám rời rạc như trước.
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
      {description && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{description}</p>}
    </div>
  );
}
