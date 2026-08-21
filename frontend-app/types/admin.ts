import type { AgentType, KnowledgeStatus } from "@ai-assistant/db/src/schema";

export type AgentPrompt = {
  agentType: AgentType;
  systemPrompt: string;
  version: number;
};

export type KnowledgeNote = {
  id: string;
  path: string;
  title: string;
  content: string;
  status: KnowledgeStatus;
  proposedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  taskCount: number;
  reminderCount: number;
};

export type UsersResponse = {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminStats = {
  totalUsers: number;
  indexedDocs: number;
  aiQueries24h: number;
};
