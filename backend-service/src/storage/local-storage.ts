// backend-service/src/storage/local-storage.ts
import fs from "fs/promises";
import path from "path";

const STORAGE_DIR = path.join(process.cwd(), "local-storage", "uploads");

export async function saveFile(key: string, buffer: Buffer): Promise<void> {
  const filePath = path.join(STORAGE_DIR, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
}

export async function readFile(key: string): Promise<Buffer> {
  const filePath = path.join(STORAGE_DIR, key);
  return fs.readFile(filePath);
}

export async function deleteFile(key: string): Promise<void> {
  const filePath = path.join(STORAGE_DIR, key);
  await fs.unlink(filePath).catch(() => {}); // bỏ qua nếu file không tồn tại
}