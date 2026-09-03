import { jwtVerify, importJWK } from "jose";

// Chỉ giữ public key ở đây, không tự ký được token giả.
const publicKeyPromise = importJWK(JSON.parse(process.env.JWT_PUBLIC_KEY!), "EdDSA");

// Dùng chung cho HTTP (token từ header) và WebSocket (token từ query string), chỉ khác chỗ lấy.
export async function verifyBackendToken(token: string): Promise<string | null> {
  try {
    const publicKey = await publicKeyPromise;
    const { payload } = await jwtVerify(token, publicKey);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    // Chữ ký sai, token hết hạn, hoặc format không hợp lệ đều coi là chưa xác thực.
    return null;
  }
}
