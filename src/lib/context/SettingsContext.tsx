"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "@/types/settings";

const STORAGE_KEY = "game-gen-settings";

interface SettingsContextValue {
  settings: Settings;
  isConfigured: boolean;
  updateSettings: (s: Partial<Settings>) => void;
  validateSettings: () => Promise<boolean>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const isConfigured = settings.apiKey.length > 0;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const validateSettings = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.apiKey,
          apiUrl: settings.apiUrl,
          model: settings.model,
        }),
      });
      const data = await res.json();
      return data.ok === true;
    } catch {
      return false;
    }
  }, [settings.apiKey, settings.apiUrl, settings.model]);

  return (
    <SettingsContext.Provider value={{ settings, isConfigured, updateSettings, validateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
