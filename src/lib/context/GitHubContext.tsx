"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface GitHubContextValue {
  isLoggedIn: boolean;
  username: string | null;
  login: () => void;
  logout: () => void;
  shareGame: (repoName: string, description: string, isPrivate: boolean) => Promise<string>;
}

const GitHubContext = createContext<GitHubContextValue | null>(null);

export function GitHubProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => {
        setIsLoggedIn(d.loggedIn);
        setUsername(d.username);
      })
      .catch(() => {});
  }, []);

  const login = useCallback(() => {
    window.location.href = "/api/auth/login";
  }, []);

  const logout = useCallback(() => {
    setIsLoggedIn(false);
    setUsername(null);
  }, []);

  const shareGame = useCallback(async (repoName: string, description: string, isPrivate: boolean): Promise<string> => {
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoName, description, isPrivate }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.repoUrl;
  }, []);

  return (
    <GitHubContext.Provider value={{ isLoggedIn, username, login, logout, shareGame }}>
      {children}
    </GitHubContext.Provider>
  );
}

export function useGitHub() {
  const ctx = useContext(GitHubContext);
  if (!ctx) throw new Error("useGitHub must be used within GitHubProvider");
  return ctx;
}
