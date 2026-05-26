import { getSessionId } from "@/lib/middleware/session";
import { getSession, createSession } from "@/lib/workspace/manager";
import { createAgent } from "@/lib/agent/factory";
import { baseTools } from "@/lib/agent/tool-defs";
import { build } from "@/lib/build/bundler";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  let body: { message?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body
  }

  const userMessage = body.message || "hello";
  const sessionId = await getSessionId();

  let session = getSession(sessionId);
  if (!session) {
    session = createSession(sessionId);
  }

  let agentMd = "";
  try {
    agentMd = fs.readFileSync(path.join(session.rootPath, "agent.md"), "utf-8");
  } catch {
    // agent.md might not exist yet
  }

  let history: Array<{ role: string; content: string }> = [];
  const historyPath = path.join(session.rootPath, "messages.json");
  try {
    const raw = fs.readFileSync(historyPath, "utf-8");
    history = JSON.parse(raw);
  } catch {
    // no history yet
  }

  history.push({ role: "user", content: userMessage });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: string, data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream closed
        }
      };

      try {
        const agent = createAgent(sessionId);
        let buildTriggered = false;

        await agent.run(agentMd, userMessage, history, baseTools, (event) => {
          switch (event.type) {
            case "status":
              emit("status", event.data);
              break;
            case "message":
              emit("message", event.data);
              break;
            case "reasoning":
              emit("reasoning", event.data);
              break;
            case "tool_call":
              emit("tool_call", event.data);
              break;
            case "question":
              emit("question", event.data);
              break;
            case "done":
              if (!buildTriggered && event.data.html) {
                buildTriggered = true;
                emit("build-complete", { html: event.data.html, errors: event.data.errors || [] });
              }
              break;
            case "error":
              emit("error", event.data);
              break;
          }
        });

        if (!buildTriggered) {
          try {
            const result = await build(sessionId);
            if (result.html) {
              emit("build-complete", { html: result.html, errors: result.errors });
            }
          } catch {
            emit("error", { message: "Build failed" });
          }
        }
      } catch (err) {
        emit("error", { message: String(err) });
      }

      try {
        fs.writeFileSync(historyPath, JSON.stringify(history.slice(-50)));
      } catch {
        // ignore
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
