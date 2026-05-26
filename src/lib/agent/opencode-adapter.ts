import { settingsStore } from "@/lib/settings-store";
import type { AgentSDK, AgentEvent, ToolDef } from "./factory";

const DEFAULT_API_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-pro";

export class OpenCodeAdapter implements AgentSDK {
  constructor(private sessionId: string) {}

  async run(
    systemPrompt: string,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }>,
    tools: ToolDef[],
    onEvent: (event: AgentEvent) => void,
  ): Promise<void> {
    const settings = settingsStore.get(this.sessionId) || settingsStore.get("default");
    const apiUrl = settings?.apiUrl || DEFAULT_API_URL;
    const apiKey = settings?.apiKey;
    const model = settings?.model || DEFAULT_MODEL;

    if (!apiKey) {
      onEvent({ type: "error", data: { message: "API key not configured. Open Settings to add your API key." } });
      return;
    }

    const toolDefs = tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: "object",
          properties: t.parameters,
          required: Object.keys(t.parameters),
        },
      },
    }));

    const messages: Array<Record<string, unknown>> = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of conversationHistory.slice(-20)) {
      messages.push({ role: msg.role === "user" ? "user" : "assistant", content: msg.content });
    }

    messages.push({ role: "user", content: userMessage });

    let maxIterations = 15;
    let currentMessages = [...messages];

    while (maxIterations-- > 0) {
      onEvent({ type: "status", data: { message: "Thinking..." } });

      const response = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: currentMessages,
          tools: toolDefs,
          tool_choice: "auto",
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        onEvent({ type: "error", data: { message: `API error (${response.status}): ${errText.slice(0, 200)}` } });
        return;
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      if (!choice) {
        onEvent({ type: "error", data: { message: "No response from model" } });
        return;
      }

      const finishReason = choice.finish_reason;
      const msg = choice.message;

      // DeepSeek thinking models return reasoning_content that MUST be
      // passed back unchanged in subsequent multi-turn calls
      const reasoningContent = (msg as Record<string, unknown>)?.reasoning_content as string | undefined;

      // Text response
      if (msg?.content) {
        onEvent({ type: "message", data: { content: msg.content } });
      }

      // Tool calls
      if (msg?.tool_calls && msg.tool_calls.length > 0) {
        currentMessages.push({
          role: "assistant",
          content: msg.content || "",
          ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
          tool_calls: msg.tool_calls,
        });

        for (const tc of msg.tool_calls) {
          const toolName = tc.function.name;
          const tool = tools.find((t) => t.name === toolName);

          onEvent({ type: "tool_call", data: { name: toolName } });

          if (!tool) {
            currentMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({ error: `Unknown tool: ${toolName}` }),
            });
            continue;
          }

          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            // empty args
          }

          const result = await tool.execute(args, this.sessionId);
          currentMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });

          if (toolName === "build_game" && result.html) {
            onEvent({
              type: "done",
              data: { html: result.html, errors: result.errors || [] },
            });
            return;
          }
        }
      }

      // Done
      if (finishReason === "stop" && !msg?.tool_calls) {
        onEvent({ type: "done", data: { message: "Generation complete" } });
        return;
      }
    }

    onEvent({ type: "error", data: { message: "Agent reached maximum iterations without completing" } });
  }
}
