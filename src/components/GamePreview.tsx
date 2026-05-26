"use client";

import { useCallback, useEffect, useRef } from "react";
import { useGame } from "@/lib/context/GameContext";
import { useChat } from "@/lib/context/ChatContext";
import { SandboxIframe } from "@/components/SandboxIframe";
import ShareButton from "@/components/ShareButton";

export default function GamePreview() {
  const { gameHtml, isBuilding, buildErrors } = useGame();
  const { sendMessage } = useChat();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!iframeRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      iframeRef.current.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "game-error") {
        const msg = event.data.message || "Unknown game error";
        const line = event.data.line ? ` (line ${event.data.line})` : "";
        sendMessage(`Game error: ${msg}${line}. Please fix this.`);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sendMessage]);

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <div className="p-3 border-b border-zinc-700 bg-zinc-800 flex justify-between items-center">
        <h2 className="text-sm font-semibold text-zinc-300">Game Preview</h2>
        <div className="flex gap-2">
          <button
            onClick={toggleFullscreen}
            disabled={!gameHtml}
            className="px-3 py-1 text-xs font-medium bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 disabled:opacity-40 transition-colors"
          >
            Fullscreen
          </button>
          <ShareButton />
        </div>
      </div>

      {isBuilding && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-zinc-600 border-t-blue-500 rounded-full mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">Building your game...</p>
          </div>
        </div>
      )}

      {buildErrors.length > 0 && !isBuilding && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-red-400 text-sm mb-2">Build failed</p>
            <p className="text-zinc-500 text-xs">{buildErrors[0]}</p>
          </div>
        </div>
      )}

      {!isBuilding && buildErrors.length === 0 && (
        <SandboxIframe ref={iframeRef} html={gameHtml} />
      )}

      <div className="px-3 py-1 border-t border-zinc-700 bg-zinc-800">
        <p className="text-xs text-zinc-600">
          sandbox=&quot;allow-scripts allow-same-origin&quot;
        </p>
      </div>
    </div>
  );
}
