import mammoth from "mammoth";
import JSZip from "jszip";
import { describeImage } from "./image-description";
import { getSettingValue } from "../db/repositories/settings";

const IMAGE_MEDIA_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
};

// Ảnh nhúng .docx/.pptx luôn nằm trong 1 thư mục media, quét thẳng đó và giới hạn số ảnh mỗi tài liệu.
async function describeEmbeddedImages(zip: JSZip, mediaFolder: string): Promise<string[]> {
  const maxImages = Math.round(await getSettingValue("maxImagesPerDocument"));
  const imageFiles = Object.keys(zip.files)
    .filter((name) => name.startsWith(mediaFolder))
    .filter((name) => (name.toLowerCase().split(".").pop() ?? "") in IMAGE_MEDIA_TYPES)
    .sort()
    .slice(0, maxImages);

  const descriptions: string[] = [];
  for (const name of imageFiles) {
    const ext = name.toLowerCase().split(".").pop()!;
    try {
      const buffer = await zip.files[name].async("nodebuffer");
      descriptions.push(await describeImage(buffer, IMAGE_MEDIA_TYPES[ext]));
    } catch (err) {
      // 1 ảnh lỗi không được làm hỏng toàn bộ document, bỏ qua ảnh đó và giữ lại phần đã thành công.
      console.error(`[office-extraction] Không mô tả được ảnh ${name}:`, err);
    }
  }
  return descriptions;
}

function appendImageDescriptions(text: string, descriptions: string[]): string {
  if (descriptions.length === 0) return text;
  const imagesText = descriptions.map((d, i) => `[Ảnh ${i + 1}]: ${d}`).join("\n");
  return text.trim().length === 0 ? imagesText : `${text}\n\n${imagesText}`;
}

export async function extractDocxContent(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });

  const zip = await JSZip.loadAsync(buffer);
  const imageDescriptions = await describeEmbeddedImages(zip, "word/media/");
  const combined = appendImageDescriptions(value ?? "", imageDescriptions);

  if (!combined || combined.trim().length === 0) {
    throw new Error("Không trích xuất được nội dung nào từ file Word này.");
  }
  return combined;
}

function decodeXmlEntities(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

// .pptx là zip XML, tự giải nén và đọc bằng regex thay vì thêm thư viện parse pptx có rủi ro.
export async function extractPptxContent(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    });

  const slideTexts: string[] = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("text");
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXmlEntities(m[1]));
    slideTexts.push(texts.join(" "));
  }
  const text = slideTexts.filter((t) => t.trim().length > 0).join("\n\n");

  const imageDescriptions = await describeEmbeddedImages(zip, "ppt/media/");
  const combined = appendImageDescriptions(text, imageDescriptions);

  if (!combined || combined.trim().length === 0) {
    throw new Error("Không trích xuất được nội dung nào từ file PowerPoint này.");
  }
  return combined;
}
