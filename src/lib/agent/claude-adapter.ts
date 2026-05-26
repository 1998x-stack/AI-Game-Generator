import { settingsStore } from "@/lib/settings-store";
import type { AgentSDK, AgentEvent, ToolDef } from "./factory";

export class ClaudeAdapter implements AgentSDK {
  constructor(private sessionId: string) {}

  async run(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }>,
    _tools: ToolDef[],
    onEvent: (event: AgentEvent) => void,
  ): Promise<void> {
    onEvent({ type: "status", data: { message: "Claude adapter: tool calling not yet implemented. Falling back to text-only mode." } });
    const settings = settingsStore.get(this.sessionId) || settingsStore.get("default");
    const apiUrl = settings?.apiUrl || "https://api.anthropic.com";
    const apiKey = settings?.apiKey;

    if (!apiKey) {
      onEvent({ type: "error", data: { message: "API key not configured." } });
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: settings?.model || "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            ...conversationHistory.slice(-20).map((m) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.content,
            })),
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        onEvent({ type: "error", data: { message: `Claude API error: ${response.status}` } });
        return;
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || "";

      if (text) {
        onEvent({ type: "message", data: { content: text } });
      }
      onEvent({ type: "done", data: {} });
    } catch (err) {
      onEvent({ type: "error", data: { message: String(err) } });
    }
  }
}
