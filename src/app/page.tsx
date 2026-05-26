"use client";

import { useEffect } from "react";
import ChatPanel from "@/components/ChatPanel";
import GamePreview from "@/components/GamePreview";
import { ChatProvider, useChat } from "@/lib/context/ChatContext";
import { GameProvider, useGame } from "@/lib/context/GameContext";
import { GitHubProvider } from "@/lib/context/GitHubContext";

function GameBridge() {
  const { setGameHtml, setBuilding, setBuildErrors } = useGame();
  const { setOnBuildComplete, isLoading } = useChat();

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
