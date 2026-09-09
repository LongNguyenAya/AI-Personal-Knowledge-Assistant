import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.S3_BUCKET_NAME;
const s3 = new S3Client({ region: process.env.AWS_REGION });

function requireBucket(): string {
  if (!BUCKET) throw new Error("S3_BUCKET_NAME chưa được set trong .env.");
  return BUCKET;
}

// An S3 key is just a flat string, checking the right prefix is enough, no traversal vulnerability like path-based storage.
export function assertOwnedKey(userId: string, key: string): void {
  if (!key.startsWith(`uploads/${userId}/`)) {
    throw new Error(`Key không hợp lệ hoặc không thuộc về user hiện tại: ${key}`);
  }
}

export async function saveFile(userId: string, key: string, buffer: Buffer): Promise<void> {
  assertOwnedKey(userId, key);
  await s3.send(new PutObjectCommand({ Bucket: requireBucket(), Key: key, Body: buffer }));
}

export async function deleteFile(userId: string, key: string): Promise<void> {
  assertOwnedKey(userId, key);
  // DeleteObject is inherently idempotent, a nonexistent key still returns success.
  await s3.send(new DeleteObjectCommand({ Bucket: requireBucket(), Key: key }));
}

// The worker reads the file back here, the SQS message only carries the key because the 256KB limit can't hold the file bytes.
export async function readFile(userId: string, key: string): Promise<Buffer> {
  assertOwnedKey(userId, key);
  const { Body } = await s3.send(new GetObjectCommand({ Bucket: requireBucket(), Key: key }));
  return Buffer.from(await Body!.transformToByteArray());
}
