import mammoth from "mammoth";
import JSZip from "jszip";
import { describeImage } from "./image-description";

// Chặn cứng số ảnh xử lý mỗi tài liệu — mỗi ảnh tốn 1 lệnh gọi Gemini riêng (khác PDF, gửi cả file
// 1 lần cho model tự đọc), tài liệu có nhiều ảnh không được phép kéo theo hàng chục lệnh gọi.
const MAX_IMAGES_PER_DOCUMENT = 10;
const IMAGE_MEDIA_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
};

// Ảnh nhúng trong .docx/.pptx luôn nằm trong đúng 1 thư mục media (word/media/, ppt/media/) bất kể
// nó được tham chiếu ở đâu trong document.xml/slideN.xml — quét thẳng thư mục này thay vì parse
// quan hệ drawing/relationship đầy đủ, đơn giản hơn nhiều mà vẫn bắt được hầu hết trường hợp thật.
async function describeEmbeddedImages(zip: JSZip, mediaFolder: string): Promise<string[]> {
  const imageFiles = Object.keys(zip.files)
    .filter((name) => name.startsWith(mediaFolder))
    .filter((name) => (name.toLowerCase().split(".").pop() ?? "") in IMAGE_MEDIA_TYPES)
    .sort()
    .slice(0, MAX_IMAGES_PER_DOCUMENT);

  const descriptions: string[] = [];
  for (const name of imageFiles) {
    const ext = name.toLowerCase().split(".").pop()!;
    try {
      const buffer = await zip.files[name].async("nodebuffer");
      descriptions.push(await describeImage(buffer, IMAGE_MEDIA_TYPES[ext]));
    } catch (err) {
      // 1 ảnh lỗi (vd Gemini từ chối, ảnh hỏng) không được làm hỏng toàn bộ document — bỏ qua ảnh
      // đó, giữ lại phần text + các ảnh mô tả thành công khác.
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

// .pptx là 1 file zip chứa XML riêng cho từng slide (ppt/slides/slideN.xml), text nằm trong thẻ
// DrawingML <a:t>. Tự giải nén + đọc text bằng regex thay vì thêm 1 thư viện parse pptx riêng —
// tránh kéo theo dependency nặng/rủi ro không cần thiết (vd officeparser kéo theo pdfjs-dist có
// lỗ hổng bảo mật đã biết + tesseract.js chỉ để OCR, không dùng tới ở đây).
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
