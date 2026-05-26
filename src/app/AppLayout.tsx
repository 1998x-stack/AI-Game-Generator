"use client";

import { useState } from "react";
import { SettingsProvider, useSettings } from "@/lib/context/SettingsContext";
import SettingsPanel from "@/components/SettingsPanel";

function SessionLink() {
  const [copied, setCopied] = useState(false);

  const copySessionLink = () => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session");
    if (!sessionId) return;

    const url = `${window.location.origin}/?session=${sessionId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const sessionId = params.get("session");
  if (!sessionId) return null;

  return (
    <button
      onClick={copySessionLink}
      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors px-2 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
      title="Copy session link to resume later"
    >
      {copied ? "Copied!" : "Copy session link"}
    </button>
  );
}

function Header() {
  const { isConfigured } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            AI Game Generator
          </h1>
          <SessionLink />
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded ${isConfigured ? "hidden" : ""}`}>
            API key required
          </span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="2.5" />
              <path d="M8 1.5v1.5M8 13v1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M1.5 8H3M13 8h1.5M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06" />
            </svg>
          </button>
        </div>
      </header>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <Header />
      {children}
    </SettingsProvider>
  );
}
