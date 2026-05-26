import { OpenCodeAdapter } from "./opencode-adapter";
import { ClaudeAdapter } from "./claude-adapter";
import { OpenAIAdapter } from "./openai-adapter";
import { settingsStore } from "@/lib/settings-store";

export type AgentEventType =
  | "message"
  | "tool_call"
  | "tool_result"
  | "status"
  | "question"
  | "done"
  | "error"
  | "reasoning";

export interface AgentEvent {
  type: AgentEventType;
  data: Record<string, unknown>;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, sessionId: string) => Promise<ToolResult>;
}

export interface ToolResult {
  content?: string;
  success?: boolean;
  error?: string;
  html?: string;
  errors?: string[];
  warnings?: string[];
  status?: string;
}

export interface AgentSDK {
  run(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }>,
    tools: ToolDef[],
    onEvent: (event: AgentEvent) => void,
  ): Promise<void>;
}

export function createAgent(sessionId: string): AgentSDK {
  const settings = settingsStore.get(sessionId) || settingsStore.get("default");
  const sdkType = settings?.sdkType;

  switch (sdkType) {
    case "claude":
      return new ClaudeAdapter(sessionId);
    case "openai":
      return new OpenAIAdapter(sessionId);
    default:
      return new OpenCodeAdapter(sessionId);
  }
}
