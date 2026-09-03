import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.S3_BUCKET_NAME;
const s3 = new S3Client({ region: process.env.AWS_REGION });

function requireBucket(): string {
  if (!BUCKET) throw new Error("S3_BUCKET_NAME chưa được set trong .env.");
  return BUCKET;
}

// S3 key chỉ là 1 chuỗi phẳng, check đúng tiền tố là đủ, không dính lỗ hổng traversal như trước.
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
  // DeleteObject vốn idempotent, key không tồn tại vẫn trả về thành công.
  await s3.send(new DeleteObjectCommand({ Bucket: requireBucket(), Key: key }));
}

// Worker đọc lại file ở đây, message SQS chỉ mang key vì giới hạn 256KB không đủ chứa bytes file.
export async function readFile(userId: string, key: string): Promise<Buffer> {
  assertOwnedKey(userId, key);
  const { Body } = await s3.send(new GetObjectCommand({ Bucket: requireBucket(), Key: key }));
  return Buffer.from(await Body!.transformToByteArray());
}
