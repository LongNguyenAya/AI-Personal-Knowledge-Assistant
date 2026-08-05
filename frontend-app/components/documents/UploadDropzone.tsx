"use client";
import { useState } from "react";

export function UploadDropzone() {
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/documents", { method: "POST", body: formData });
    setUploading(false);

    if (res.ok) {
      alert("Upload thành công, đang xử lý...");
    } else {
      alert("Upload thất bại");
    }
  }

  return (
    <div>
      <input type="file" accept=".pdf,.txt,.md" onChange={handleFileChange} disabled={uploading} />
      {uploading && <p>Đang upload...</p>}
    </div>
  );
}