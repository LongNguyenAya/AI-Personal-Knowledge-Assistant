import { jwtVerify, importJWK } from "jose";

// Only holds the public key here, can't forge tokens itself.
const publicKeyPromise = importJWK(JSON.parse(process.env.JWT_PUBLIC_KEY!), "EdDSA");

// Shared by both HTTP (token from header) and WebSocket (token from query string), only the source differs.
export async function verifyBackendToken(token: string): Promise<string | null> {
  try {
    const publicKey = await publicKeyPromise;
    const { payload } = await jwtVerify(token, publicKey);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    // A bad signature, expired token, or invalid format are all treated as unauthenticated.
    return null;
  }
}
