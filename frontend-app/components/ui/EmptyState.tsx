// Dùng chung cho mọi danh sách rỗng, viền đứt nét mượn ngôn ngữ hình ảnh đã có ở UploadDropzone.
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
      {description && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{description}</p>}
    </div>
  );
}
