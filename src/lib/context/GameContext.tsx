"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface GameContextValue {
  gameHtml: string | null;
  isBuilding: boolean;
  buildErrors: string[];
  setGameHtml: (html: string) => void;
  setBuilding: (building: boolean) => void;
  setBuildErrors: (errors: string[]) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [gameHtml, setGameHtml] = useState<string | null>(null);
  const [isBuilding, setBuilding] = useState(false);
  const [buildErrors, setBuildErrors] = useState<string[]>([]);

  return (
    <GameContext.Provider value={{ gameHtml, isBuilding, buildErrors, setGameHtml, setBuilding, setBuildErrors }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
