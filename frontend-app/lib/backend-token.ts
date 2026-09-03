import { SignJWT, importJWK } from "jose";

// Private key chỉ tồn tại ở frontend-app, backend-service chỉ có public key nên chỉ nơi này ký được token hợp lệ.
const privateKeyPromise = importJWK(JSON.parse(process.env.JWT_PRIVATE_KEY!), "EdDSA");

// Token ngắn hạn (60s), chỉ cần sống đủ lâu để backend-service xử lý xong 1 request, không phải session token dài hạn.
export async function mintBackendToken(userId: string): Promise<string> {
  const privateKey = await privateKeyPromise;
  return new SignJWT({})
    .setProtectedHeader({ alg: "EdDSA" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(privateKey);
}
