// A shared helper for every client page, calling res.json() directly without checking res.ok would throw a SyntaxError and hang the page forever.
export async function fetchJson<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Yêu cầu thất bại (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
