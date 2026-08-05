"use client";
import { useEffect, useState } from "react";

export default function RemindersPage() {
  const [reminders, setReminders] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");

  async function loadReminders() {
    const res = await fetch("/api/reminders");
    setReminders(await res.json());
  }

  useEffect(() => {
    loadReminders();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, dueAt }),
    });
    setTitle("");
    setDueAt("");
    loadReminders();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
    loadReminders();
  }

  return (
    <div>
      <h1>Reminders</h1>
      <form onSubmit={handleCreate}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề" required />
        <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
        <button type="submit">Tạo</button>
      </form>

      <ul>
        {reminders.map((r) => (
          <li key={r.id}>
            {r.title} — {new Date(r.dueAt).toLocaleString()} — [{r.source}] — {r.status}
            <button onClick={() => handleDelete(r.id)}>Xóa</button>
          </li>
        ))}
      </ul>
    </div>
  );
}