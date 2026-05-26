export type MessageRole = "user" | "agent" | "system";

export type MessageType = "text" | "status" | "error" | "question" | "reasoning" | "tool_call" | "tool_result";

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  type?: MessageType;
  options?: string[];
  reasoning_content?: string;
  toolCalls?: ToolCallRecord[];
  toolName?: string;
}
