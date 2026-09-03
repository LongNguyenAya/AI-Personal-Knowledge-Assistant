export type Conversation = { id: string; title: string | null; createdAt: string };

export type StoredMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  toolResults: { toolName: string; input?: unknown; output: unknown }[] | null;
  createdAt: string;
};
