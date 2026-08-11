import { jwtVerify, importJWK } from "jose";

// Chỉ giữ public key ở đây — không ký được token giả, chỉ verify được chữ ký do frontend-app
// tạo ra (private key nằm bên đó).
const publicKeyPromise = importJWK(JSON.parse(process.env.JWT_PUBLIC_KEY!), "EdDSA");

// Dùng chung cho middleware HTTP thường (token từ header Authorization) và WebSocket (token từ
// query string) — cùng 1 cơ chế JWT, chỉ khác chỗ lấy token.
export async function verifyBackendToken(token: string): Promise<string | null> {
  try {
    const publicKey = await publicKeyPromise;
    const { payload } = await jwtVerify(token, publicKey);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    // Chữ ký sai, token hết hạn, hoặc format không hợp lệ — đều coi là chưa xác thực.
    return null;
  }
}
