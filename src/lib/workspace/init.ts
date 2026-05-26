import fs from "fs";
import path from "path";
import type { SessionWorkspace } from "./manager";

export function initWorkspace(session: SessionWorkspace): void {
  const agentMd = generateAgentMd(session);
  fs.writeFileSync(path.join(session.rootPath, "agent.md"), agentMd);

  // Set read-only permissions (works on Unix)
  try {
    fs.chmodSync(path.join(session.rootPath, "agent.md"), 0o444);
  } catch {
    // Windows may not support chmod
  }
}

function generateAgentMd(session: SessionWorkspace): string {
  const gotchas = loadGotchas();

  return `# System Instructions (IMMUTABLE — DO NOT MODIFY)

## Workspace Constraints
- You can ONLY read/write files within user_space/ (scripts/, assets/)
- You CAN read workspace/docs/ and workspace/templates/ for reference
- You MUST NOT access any other directory on the system
- Your workspace is: ${session.userSpacePath}

## Game Generation Rules
- Read workspace/docs/gotchas.md BEFORE generating any game code
- Reference workspace/templates/ for existing game patterns
- All game code goes in user_space/scripts/
- All assets (images, audio) go in user_space/assets/
- Entry point must be user_space/scripts/main.js

## Build Protocol
- After generating code, you MUST call the build_game tool
- build_game packages scripts/ + assets/ into a single self-contained game.html
- The HTML will be injected into an iframe for the user to play
- Do NOT call build_game until all files are written

## Quality Rules
- Games MUST be fully playable (not static/demo)
- Generate complete games — all states: start, play, game-over, restart
- Canvas-based rendering preferred for games
- Use requestAnimationFrame for game loops, NEVER setInterval
- Clear canvas each frame before redrawing

${gotchas}

## Interaction
- You can ask the user questions using the ask_user tool with A/B/C/D options
- After each code change, call build_game to show the user the result
- If the user asks for changes, prefer editing existing files over rewriting them
`;
}

function loadGotchas(): string {
  const gotchasPath = path.resolve("workspace/docs/gotchas.md");
  if (fs.existsSync(gotchasPath)) {
    return fs.readFileSync(gotchasPath, "utf-8");
  }
  return "";
}
