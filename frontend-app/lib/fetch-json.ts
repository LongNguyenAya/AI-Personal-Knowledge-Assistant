// Helper chung cho mọi trang client, gọi res.json() trực tiếp mà không check res.ok sẽ ném SyntaxError khiến trang treo mãi.
export async function fetchJson<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Yêu cầu thất bại (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
