export interface DocumentSearchResult {
  content: string;
  documentId: string;
  fileName: string;
}

// Output tool searchDocuments, kèm documentId/fileName để FE hiện được nguồn thật, không chỉ content trơn.
export type SearchDocumentsOutput = { results: DocumentSearchResult[] };
