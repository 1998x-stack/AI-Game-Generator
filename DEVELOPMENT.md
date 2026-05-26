# DEVELOPMENT.md — Lessons Learned & Gotchas

> Gathered during the build, audit, and fix cycle of the AI Game Generator (May 2026).

---

## Architecture Gotchas

### 1. Session ID Must Thread Through the Entire Agent Chain

**Problem**: The agent factory, adapters, and tool execution all hardcoded `"default"` as the session ID. This meant all users shared the same workspace and settings.

**Fix**: Pass `sessionId` through every layer:
```
chat/route.ts → createAgent(sessionId) → Adapter(sessionId) → tool.execute(args, sessionId)
```

**Pattern**: Never hardcode identifiers in multi-tenant systems. Thread context from the entry point down.

### 2. `createSession()` Must Call `initWorkspace()` Atomically

**Problem**: `manager.ts::createSession()` created directories but never wrote `agent.md`. The `initWorkspace()` function existed but was disconnected from the creation flow.

**Fix**: Import and call `initWorkspace()` inside `createSession()`. Session creation is an atomic operation — directory structure + agent.md must happen together.

### 3. GitHub API: Build All Blobs First, Then One Tree, Then One Commit

**Problem**: The share route created one blob + tree + commit per file in a loop, with a `break` after the first iteration. Only README.md was pushed.

**Fix**: Single pass — collect all blobs, build one tree with all entries, create one commit.

**Pattern**: When pushing to GitHub via API:
1. Create blobs for ALL files
2. Create ONE tree with ALL blob entries
3. Create ONE commit pointing to that tree
4. Update ONE ref

### 4. SSE Parser: Track Event State Across Buffer Chunks

**Problem**: The SSE parser reset `eventType` and `pendingData` on each `while` iteration. When a `\n\n` boundary split across `reader.read()` chunks, partial lines were lost.

**Fix**: Hoist `eventType` and `pendingData` out of the `while` loop. Process `event:` lines by flushing any previous pending event first, then accumulate `data:` lines with `+=` (not `=`), and dispatch on empty lines.

**Pattern**: SSE parsers must handle multipart events gracefully. Never reset state at chunk boundaries.

### 5. Settings Session ID Must Match Chat Session ID

**Problem**: Settings route used `x-session-id` header while chat route used cookies. Settings always fell back to `"default"`.

**Fix**: Use `getSessionId()` (cookie-based) everywhere. One session identification mechanism for all routes.

---

## Frontend Gotchas

### 6. Runtime Errors from iframe Must Be Surfaced to Chat

**Problem**: The postMessage error handler in `GamePreview` only called `console.log()`. Runtime game errors were silently invisible to users.

**Fix**: Forward errors to `ChatContext.sendMessage()` so they appear as chat messages the user can act on.

**Pattern**: The iframe-to-parent bridge is only half the story. Always forward events to the appropriate UI context.

### 7. Fullscreen: Use React Refs, Not `document.querySelector`

**Problem**: Fullscreen used `document.querySelector("iframe[title='Game Preview']")` — fragile, depends on exact title match.

**Fix**: Use `forwardRef` on `SandboxIframe` and pass the ref from the parent. Deterministic, no DOM queries needed.

### 8. Responsive Layout: Add Breakpoints for Split Panels

**Problem**: The 40/60 split layout used fixed `w-2/5` and `w-3/5` with no responsive fallback. Below ~700px, panels overflow.

**Fix**: Add `flex-col lg:flex-row` to the container, `w-full lg:w-2/5` to children. Stacks vertically on mobile.

---

## Agent / Backend Gotchas

### 9. Multi-SDK Adapters Must Actually Implement Tool Calling

**Problem**: Claude and OpenAI adapters accepted `_tools` but never passed them to the API. They were text-only wrappers — misleading to users.

**Fix**: Added `onEvent` warning that tool calling is not yet implemented. Honest about limitations.

**Pattern**: Placeholder adapters should loudly announce their limitations, not silently degrade.

### 10. API Keys Must Not Leak in Error Messages

**Problem**: Error responses from LLM APIs could contain the API key in their body, which was then forwarded to the client.

**Fix**: Truncated error body to 200 chars as a safety net. Consider stripping known key patterns in production.

### 11. Settings GET Must Check Per-Session, Not Global

**Problem**: `GET /api/settings` returned `configured: true` if ANY session had settings, leaking information across sessions.

**Fix**: Check `settingsStore.get(sessionId)` instead of `settingsStore.size > 0`.

---

## Build Pipeline Gotchas

### 12. Image Base64 Inlining Must Be Explicit, Not Assumed

**Problem**: The build guide told agents "reference images by filename — the build tool handles it" but esbuild does NOT auto-inline image references. Games with `img.src = "sprite.png"` would break.

**Fix**: Scan `assets/` for image/audio files, read them, convert to base64 data URIs, and inject as `window.__gameAssets` before the game script. Games can then reference `__gameAssets["sprite.png"]`.

### 13. `serverExternalPackages: ["esbuild"]` Required for Next.js

**Problem**: Turbopack tried to bundle esbuild's native binary, causing build failures.

**Fix**: Add `serverExternalPackages: ["esbuild"]` to `next.config.ts`. Any native Node module must be externalized.

---

## Scaffolding Gotchas

### 14. agent.md Must Be Generated at Session Creation Time

**Problem**: The `initWorkspace()` function existed but was never called. The `sessions/` directory was empty — no `agent.md` files.

**Fix**: Integrated `initWorkspace()` into `createSession()`. Session creation is atomic.

### 15. Build Guide Must Match Actual Build Tool Behavior

**Problem**: `build-guide.md` claimed images would be base64 inlined, but the bundler didn't do it. Agents following the guide would produce broken games.

**Fix**: Implemented image inlining (see #12). Documentation and implementation must stay in sync.

### 16. Game Templates Should Test Edge Cases

**Problems found in templates**:
- Snake: softlock when board is full (no food can spawn)
- Tetris: delta time not clamped (backgrounding causes instant drops)
- Breakout: no touch controls for mobile
- 2048: DOM-based not Canvas (acceptable but deviates from guidelines)

**Action**: Most are acceptable for templates. Document the tradeoffs.

---

## Process Gotchas

### 17. Audit Before You Ship

The 3-agent parallel audit (frontend, backend, workspace) found 25+ issues across all layers. Many were non-obvious from reading individual files — only cross-referencing specs against implementation caught the integration gaps.

### 18. Phase Documents Are Contracts

The phased spec docs are the source of truth. Every verification checklist item should be testable. When implementation deviates (e.g., adding `sdkType` to settings before its phase), the deviation should be noted.

### 19. One Session ID Mechanism

Three different session identification mechanisms were in play (cookies, headers, hardcoded "default"). Standardize on cookies via `getSessionId()` for all API routes.

---

## Remaining Known Issues

| # | Issue | Severity | Plan |
|---|-------|----------|------|
| K1 | Claude/OpenAI adapters lack tool calling | Medium | Implement for v2 |
| K2 | MCP tools not merged into agent tools | Low | Wire in v2 |
| K3 | Touch input missing in 3 of 4 templates | Low | Add as needed |
| K4 | Snake full-board softlock | Low | Edge case, document |
| K5 | No CSRF state in GitHub OAuth | Low | Add for production |
| K6 | PostMessage uses `'*'` target origin | Low | Tighten for production |
