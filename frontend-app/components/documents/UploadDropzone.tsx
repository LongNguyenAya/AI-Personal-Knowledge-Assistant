"use client";
import { useState } from "react";

export function UploadDropzone({ onUploaded }: { onUploaded?: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/documents", { method: "POST", body: formData });
    setUploading(false);
    e.target.value = "";

    // The actual upload is processed asynchronously via SQS, the POST only returns once enqueued, the parent page handles polling until processing finishes.
    setMessage(
      res.ok ? { text: "Upload succeeded, queued for processing.", ok: true } : { text: "Upload failed", ok: false }
    );
    if (res.ok) onUploaded?.();
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
      <label className="cursor-pointer">
        <input
          type="file"
          accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />
        <span className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700">
          {uploading ? "Uploading..." : "Choose file to upload"}
        </span>
      </label>
      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">Supports .pdf, .docx, .pptx, .txt, .md, .png, .jpg, .jpeg, .webp</p>
      {message && (
        <p className={`mt-3 text-sm ${message.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
