import { SignJWT, importJWK } from "jose";

// The private key only exists in frontend-app, backend-service only has the public key so this is the only place that can sign a valid token.
const privateKeyPromise = importJWK(JSON.parse(process.env.JWT_PRIVATE_KEY!), "EdDSA");

// A short-lived token (60s), only needs to live long enough for backend-service to finish processing 1 request, not a long-lived session token.
export async function mintBackendToken(userId: string): Promise<string> {
  const privateKey = await privateKeyPromise;
  return new SignJWT({})
    .setProtectedHeader({ alg: "EdDSA" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(privateKey);
}
