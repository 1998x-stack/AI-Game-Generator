import { settingsStore } from "@/lib/settings-store";
import type { AgentSDK, AgentEvent, ToolDef } from "./factory";

export class OpenAIAdapter implements AgentSDK {
  constructor(private sessionId: string) {}

  async run(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }>,
    _tools: ToolDef[],
    onEvent: (event: AgentEvent) => void,
  ): Promise<void> {
    onEvent({ type: "status", data: { message: "OpenAI adapter: tool calling not yet implemented. Falling back to text-only mode." } });
    const settings = settingsStore.get(this.sessionId) || settingsStore.get("default");
    const apiUrl = settings?.apiUrl || "https://api.openai.com";
    const apiKey = settings?.apiKey;

    if (!apiKey) {
      onEvent({ type: "error", data: { message: "API key not configured." } });
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: settings?.model || "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            ...conversationHistory.slice(-20).map((m) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.content,
            })),
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        onEvent({ type: "error", data: { message: `OpenAI API error: ${response.status}` } });
        return;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "";

      if (text) {
        onEvent({ type: "message", data: { content: text } });
      }
      onEvent({ type: "done", data: {} });
    } catch (err) {
      onEvent({ type: "error", data: { message: String(err) } });
    }
  }
}
