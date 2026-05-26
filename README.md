# 🎮 AI Game Generator

> Generate playable HTML5 games through natural language conversation — no coding required.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

---

## ✨ What It Does

**Type a game idea → AI generates it → Play instantly in your browser.**

Describe any game in natural language — *"Make a snake game"*, *"Create a space shooter with aliens"*, *"Build a platformer with double jump"* — and the AI agent autonomously:

1. Reads game development best practices and known pitfalls
2. Generates complete, playable HTML5/Canvas game code
3. Packages everything into a self-contained game
4. Renders it in a sandboxed preview panel

Then iterate: *"Make the snake faster"*, *"Add a score counter"*, *"Change the background to space"* — the agent reads your existing code and applies targeted edits.

---

## 🎯 Features

### Core
- **Chat-driven game generation** — Natural language to playable game in seconds
- **Real-time preview** — Sandboxed iframe renders games instantly
- **Multi-turn refinement** — Iterate on games through conversation
- **Multi-SDK support** — DeepSeek, Claude, OpenAI (pluggable factory pattern)

### Game Quality
- **Scaffold knowledge base** — Game dev guides, common gotchas, reusable patterns
- **Template library** — Snake, Tetris, Breakout, 2048 as reference implementations
- **Utility library** — Pre-built game loop, collision detection, input management, sprite handling, object pooling
- **Build pipeline** — ES module bundling with esbuild, asset inlining, single-file output

### Developer Experience
- **TypeScript** throughout — full type safety across frontend and backend
- **SSE streaming** — Real-time agent progress in chat
- **Error bridging** — Game runtime errors surfaced directly in the conversation
- **Workspace isolation** — Per-session sandboxed filesystem with path validation
- **Fullscreen mode** — Play games fullscreen with one click
- **GitHub sharing** — Push generated games to your GitHub repos

### Security
- **Iframe sandbox** — `allow-scripts` only, no same-origin access
- **Path validation** — Three-layer defense: `..` rejection, boundary checks, symlink resolution
- **API key protection** — Keys stored in memory, redacted from error messages
- **Session isolation** — UUID-validated per-session workspaces

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- A DeepSeek, OpenAI, or Claude API key

### Installation

```bash
git clone https://github.com/1998x-stack/AI-Game-Generator.git
cd AI-Game-Generator
npm install
```

### Configuration

Create `.env.local` (optional — for GitHub sharing):
```env
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_secret
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click the gear icon, and enter your API key. Then start describing games!

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                             │
│  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │  Chat Panel  │  │        Game Preview              │ │
│  │  (40%)       │  │        (60%)                     │ │
│  │              │  │  ┌────────────────────────────┐  │ │
│  │  Messages    │  │  │   Sandboxed iframe         │  │ │
│  │  + Input     │  │  │   sandbox="allow-scripts"  │  │ │
│  │              │  │  │   postMessage bridge       │  │ │
│  └──────────────┘  │  └────────────────────────────┘  │ │
│                    └──────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ SSE
┌──────────────────────▼──────────────────────────────────┐
│                   Next.js Server                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  /api/chat     Agent orchestration (SSE stream)  │   │
│  │  /api/build    esbuild pipeline                  │   │
│  │  /api/settings API key management                │   │
│  │  /api/share    GitHub push                       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Agent Factory (Pluggable SDKs)                  │   │
│  │  ├── OpenCodeAdapter (DeepSeek)                  │   │
│  │  ├── ClaudeAdapter                               │   │
│  │  └── OpenAIAdapter                               │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                │
│  ┌──────────────────────▼───────────────────────────┐   │
│  │  Workspace Manager                                │   │
│  │  sessions/{id}/user_space/                        │   │
│  │  ├── scripts/    (agent writes game code)         │   │
│  │  ├── assets/     (images, audio)                  │   │
│  │  └── agent.md    (immutable system rules)         │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                │
│  ┌──────────────────────▼───────────────────────────┐   │
│  │  Build Pipeline (esbuild)                         │   │
│  │  scripts/ + assets/ → single game.html            │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Generation Flow

```
User: "Make a snake game"
  → Agent reads workspace/docs/gotchas.md
  → Agent reads workspace/templates/snake.html
  → Agent writes scripts/main.js + scripts/snake.js
  → Agent calls build_game → esbuild → game.html
  → SSE build-complete → iframe updated
  → User plays!

User: "Make it faster"
  → Agent reads existing scripts/snake.js
  → Agent edits SPEED constant
  → Agent calls build_game → new game.html
  → iframe updates instantly
```

---

## 📁 Project Structure

```
AI-Game-Generator/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/          # SSE agent streaming
│   │   │   ├── build/         # esbuild pipeline
│   │   │   ├── settings/      # API key management
│   │   │   ├── auth/          # GitHub OAuth
│   │   │   └── share/         # GitHub push
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Split-panel page
│   ├── components/
│   │   ├── ChatPanel.tsx      # Chat interface
│   │   ├── ChatInput.tsx      # Message input
│   │   ├── MessageList.tsx    # Message display
│   │   ├── GamePreview.tsx    # Game iframe wrapper
│   │   ├── SandboxIframe.tsx  # Sandboxed iframe
│   │   ├── SettingsPanel.tsx  # API key config
│   │   └── ShareButton.tsx    # GitHub share
│   ├── lib/
│   │   ├── agent/             # Agent factory + adapters + tools
│   │   ├── build/             # esbuild bundler
│   │   ├── context/           # React contexts (Chat, Game, Settings, GitHub)
│   │   ├── workspace/         # Session manager + agent.md generator
│   │   ├── mcp/               # MCP tool registry
│   │   └── middleware/        # Session cookie handling
│   └── types/                 # Shared TypeScript types
│
├── workspace/                 # Scaffolding (agent's knowledge base)
│   ├── docs/
│   │   ├── game-dev-guide.md  # Game development patterns
│   │   ├── game-patterns.md   # Reusable architecture patterns
│   │   ├── gotchas.md         # Common pitfalls
│   │   └── build-guide.md     # Build tool reference
│   ├── templates/             # Reference game implementations
│   │   ├── snake.html         # Snake game
│   │   ├── tetris.html        # Tetris
│   │   ├── breakout.html      # Breakout / Brick Breaker
│   │   └── 2048.html          # 2048 puzzle
│   └── lib/                   # Reusable game utilities
│       ├── game-loop.js       # rAF wrapper with delta time
│       ├── collision.js       # AABB, circle, SAT collision
│       ├── input.js           # Keyboard, touch, gamepad
│       ├── sprite-manager.js  # Sprite sheets + animations
│       ├── sound-manager.js   # Web Audio API wrapper
│       └── object-pool.js     # Object pooling for performance
│
├── DEVELOPMENT.md             # Development gotchas & conventions
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## 🔧 Tool System

The agent has access to these tools during game generation:

| Tool | Description |
|------|-------------|
| `read_file` | Read any file from workspace or user_space |
| `write_file` | Create or overwrite files in user_space/ |
| `edit_file` | Targeted find-and-replace edits |
| `build_game` | Package scripts + assets into playable HTML |
| `ask_user` | Ask the user A/B/C/D questions for clarification |
| `generate_image` | AI image generation (MCP, placeholder) |
| `generate_audio` | AI audio/sound effect generation (MCP, placeholder) |

All file operations are path-validated — the agent cannot escape `user_space/`.

---

## 🎨 Game Templates

The `workspace/templates/` directory contains complete, playable reference games:

| Template | Features |
|----------|----------|
| **Snake** | Grid-based movement, 180° prevention, food spawning, touch controls, difficulty scaling |
| **Tetris** | 7 standard pieces, ghost piece, wall kicks, scoring, hold piece, level progression |
| **Breakout** | Paddle physics, brick destruction, power-ups, particle effects, multi-ball |
| **2048** | Grid merging, swipe/keyboard, undo, high score, responsive, animations |

Each template demonstrates proper patterns: game state machines, `requestAnimationFrame` loops, collision detection, and input handling.

---

## 📚 Scaffold Knowledge Base

### game-dev-guide.md
Comprehensive HTML5 game development reference covering game loops, canvas rendering, collision detection (AABB, circle, SAT), input handling (keyboard, touch, gamepad), sprite management, audio, fixed timestep, ECS pattern, object pooling, and performance optimization.

### game-patterns.md
Reusable architecture patterns: state machines, game loop with fixed timestep, entity-component system, object pooling, sprite animation, scrolling backgrounds, particle systems, and score/UI management.

### gotchas.md
Common pitfalls the agent must avoid: 180° turns in Snake, delta time clamping, canvas ID conventions (`gameCanvas` not `game`), module scope rules, utility pre-loading, asset embedding, no external dependencies, and sound lock requirements.

### build-guide.md
How the build pipeline works: entry point conventions, asset usage, `window.__ASSETS__` access, error handler bridge, and troubleshooting common build failures.

---

## 🤝 Contributing

### Adding a New Game Template
1. Add your template to `workspace/templates/`
2. Use `id="gameCanvas"` for the canvas element
3. Follow the patterns in existing templates
4. Reference `DEVELOPMENT.md` for gotchas

### Adding a New LLM Provider
1. Implement the `AgentSDK` interface in `src/lib/agent/`
2. Register in `factory.ts`
3. Add provider option to `SettingsPanel.tsx`

### Adding a New Scaffold Doc
1. Add `.md` file to `workspace/docs/`
2. It will be auto-loaded into the agent's system prompt

---

## 📄 License

MIT

---

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org/) — React framework
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [esbuild](https://esbuild.github.io/) — JavaScript bundling
- [DeepSeek](https://deepseek.com/) — Default LLM provider

---

**Start creating games with natural language — no coding required.** 🎮
