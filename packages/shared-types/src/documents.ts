export interface DocumentSearchResult {
  content: string;
  documentId: string;
  fileName: string;
}

// Output thật của tool searchDocuments (backend-service) — có documentId/fileName kèm content để
// FE hiện được nguồn thật sự đã dùng (giống source-document ở research agent), thay vì chỉ có
// chuỗi content trơn mà cả model lẫn FE đều không biết trích từ tài liệu nào.
export type SearchDocumentsOutput = { results: DocumentSearchResult[] };
