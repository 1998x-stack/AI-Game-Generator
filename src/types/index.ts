export type MessageRole = "user" | "agent" | "system";

export type MessageType = "text" | "status" | "error" | "question";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  type?: MessageType;
  options?: string[];
}
