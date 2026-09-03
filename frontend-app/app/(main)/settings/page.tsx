"use client";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

const MAX_LENGTH = 2000;

// "Hồ sơ cá nhân" là đoạn tự do do chính user viết trước, luôn được đưa vào mọi prompt của action-agent, khác Ghi chú AI.
export default function SettingsPage() {
  const [note, setNote] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { personalNote } = await fetchJson<{ personalNote: string }>("/api/settings");
        setNote(personalNote);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được hồ sơ cá nhân");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await fetchJson("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalNote: note }),
      });
      setError(null);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hồ sơ cá nhân</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Viết 1 lần, AI sẽ luôn đọc thông tin này mỗi khi xử lý yêu cầu của bạn — vd thói quen làm việc, cách bạn muốn AI ưu tiên việc.
        </p>
      </div>

      {error && (
        <div className="mb-3">
          <ErrorBanner message={error} />
        </div>
      )}

      {!loaded ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Đang tải...</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-soft dark:border-gray-800 dark:bg-gray-900">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={MAX_LENGTH}
            rows={6}
            placeholder={`Ví dụ: "Tôi làm việc giờ hành chính, ưu tiên deadline trong tuần hơn cuối tuần."`}
            className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-indigo-500/20"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {note.length}/{MAX_LENGTH}
              {savedAt && !saving ? " · Đã lưu" : ""}
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
