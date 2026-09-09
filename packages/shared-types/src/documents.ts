export interface DocumentSearchResult {
  content: string;
  documentId: string;
  fileName: string;
}

// Output of the searchDocuments tool, includes documentId/fileName so the FE can show the real source, not just plain content.
export type SearchDocumentsOutput = { results: DocumentSearchResult[] };
