export interface DocumentSearchResult {
  content: string;
  documentId: string;
  fileName: string;
}

// Output of the searchDocuments tool, includes documentId/fileName so the FE can show the real source, not just plain content.
// hasAnyDocuments is only meaningful when results is empty, tells apart "no documents at all" from "nothing relevant to this query".
export type SearchDocumentsOutput = { results: DocumentSearchResult[]; hasAnyDocuments?: boolean };
