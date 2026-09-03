"use client";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type Setting = {
  key: string;
  label: string;
  description: string;
  default: number;
  min: number;
  max: number;
  value: number;
  updatedAt: string | null;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await fetchJson<Setting[]>("/api/admin/settings");
      setSettings(data);
      setDrafts(Object.fromEntries(data.map((s) => [s.key, String(s.value)])));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách cài đặt");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(setting: Setting) {
    const value = Number(drafts[setting.key]);
    if (!Number.isFinite(value) || value < setting.min || value > setting.max) {
      setError(`Giá trị phải là số trong khoảng ${setting.min} - ${setting.max}`);
      return;
    }
    setSavingKey(setting.key);
    try {
      await fetchJson(`/api/admin/settings/${setting.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      setSavedKey(setting.key);
      setTimeout(() => setSavedKey(null), 2000);
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Cài đặt hệ thống</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Các ngưỡng chỉ là ước lượng ban đầu, chưa có đủ dữ liệu thật để hiệu chỉnh sẵn — tự tinh chỉnh nếu thấy hành vi chưa hợp lý.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {settings === null && <p className="text-sm text-gray-400 dark:text-gray-500">Đang tải...</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {settings?.map((s) => {
          const dirty = drafts[s.key] !== String(s.value);
          return (
            <div key={s.key} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h3 className="font-semibold text-gray-900 dark:text-white">{s.label}</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{s.description}</p>

              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  min={s.min}
                  max={s.max}
                  value={drafts[s.key] ?? ""}
                  onChange={(e) => setDrafts({ ...drafts, [s.key]: e.target.value })}
                  className="w-32 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-indigo-500/20"
                />
                <button
                  onClick={() => save(s)}
                  disabled={savingKey === s.key || !dirty}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
                >
                  {savingKey === s.key ? "Đang lưu..." : "Lưu"}
                </button>
                {savedKey === s.key && <span className="text-xs font-medium text-green-600 dark:text-green-400">Đã lưu</span>}
              </div>

              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                Mặc định: {s.default} (khoảng hợp lệ {s.min}–{s.max})
                {s.updatedAt && ` · Cập nhật lúc ${new Date(s.updatedAt).toLocaleString("vi-VN")}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
