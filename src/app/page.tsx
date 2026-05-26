"use client";

import { useEffect, useRef } from "react";
import ChatPanel from "@/components/ChatPanel";
import GamePreview from "@/components/GamePreview";
import { ChatProvider, useChat } from "@/lib/context/ChatContext";
import { GameProvider, useGame } from "@/lib/context/GameContext";
import { GitHubProvider } from "@/lib/context/GitHubContext";

function GameBridge() {
  const { setGameHtml, setBuilding, setBuildErrors } = useGame();
  const { setOnBuildComplete, isLoading } = useChat();
  const resumed = useRef(false);

  useEffect(() => {
    if (isLoading) setBuilding(true);
  }, [isLoading, setBuilding]);

  useEffect(() => {
    setOnBuildComplete((html: string) => {
      setGameHtml(html);
      setBuilding(false);
      setBuildErrors([]);
    });
    return () => setOnBuildComplete(null);
  }, [setOnBuildComplete, setGameHtml, setBuilding, setBuildErrors]);

  // On mount, read session cookie and update URL so user can bookmark
  useEffect(() => {
    if (resumed.current) return;
    const params = new URLSearchParams(window.location.search);
    const urlSession = params.get("session");
    if (urlSession) {
      // Set cookie from URL param for session resume
      document.cookie = `session_id=${urlSession};path=/;max-age=86400;SameSite=Lax`;
      resumed.current = true;
      // Trigger rebuild to restore game preview
      fetch("/api/build", { method: "POST" })
        .then(async (res) => { if (res.ok) { const d = await res.json(); if (d.html) setGameHtml(d.html); } })
        .catch(() => {});
    } else {
      // Read cookie and update URL
      const match = document.cookie.match(/session_id=([^;]+)/);
      if (match && match[1]) {
        const url = new URL(window.location.href);
        url.searchParams.set("session", match[1]);
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [setGameHtml]);

  return null;
}

function HomeInner() {
  return (
    <>
      <GameBridge />
      <div className="flex flex-1 w-full flex-col lg:flex-row">
        <div className="lg:w-2/5 w-full min-h-[200px] lg:min-h-0">
          <ChatPanel />
        </div>
        <div className="lg:w-3/5 w-full min-h-[300px] lg:min-h-0">
          <GamePreview />
        </div>
      </div>
    </>
  );
}

export default function Home() {
  return (
    <ChatProvider>
      <GameProvider>
        <GitHubProvider>
          <HomeInner />
        </GitHubProvider>
      </GameProvider>
    </ChatProvider>
  );
}
