import type { ToolResult } from "@/lib/agent/factory";

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>, sessionId: string) => Promise<ToolResult>;
}

const mcpRegistry = new Map<string, MCPTool>();

export function registerMCPTool(tool: MCPTool): void {
  mcpRegistry.set(tool.name, tool);
}

export function getMCPTools(): MCPTool[] {
  return Array.from(mcpRegistry.values());
}

// Register placeholder tools
registerMCPTool({
  name: "generate_image",
  description: "Generate an image using AI. Saves to user_space/assets/",
  parameters: {
    prompt: { type: "string", description: "Image description" },
    filename: { type: "string", description: "Output filename (e.g., sprite.png)" },
  },
  handler: async () => {
    return { error: "Image generation not configured. Set up an image generation API." };
  },
});

registerMCPTool({
  name: "generate_audio",
  description: "Generate audio/sound effect. Saves to user_space/assets/",
  parameters: {
    prompt: { type: "string", description: "Sound description" },
    filename: { type: "string", description: "Output filename (e.g., explosion.mp3)" },
  },
  handler: async () => {
    return { error: "Audio generation not configured. Set up an audio generation API." };
  },
});
