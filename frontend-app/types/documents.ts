export type Document = {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
  flaggedSuspicious: boolean;
  flagReason: string | null;
};
