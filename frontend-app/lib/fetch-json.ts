// Helper chung cho mọi trang client — gọi fetch().then(res.json()) trực tiếp mà không check
// res.ok thì khi API trả lỗi dạng text (vd 401 Unauthorized), res.json() ném SyntaxError không
// ai bắt, trang treo ở "Đang tải..." mãi mà không báo gì cho user. fetchJson luôn throw Error
// có message rõ ràng khi request thất bại.
export async function fetchJson<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Yêu cầu thất bại (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
