"use client";

import { createContext, useCallback, useContext, useReducer, useRef } from "react";
import type { ChatMessage } from "@/types";

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
}

type ChatAction =
  | { type: "ADD_MESSAGE"; message: ChatMessage }
  | { type: "UPDATE_LAST_AGENT"; content: string }
  | { type: "SET_LOADING"; loading: boolean };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] };
    case "UPDATE_LAST_AGENT": {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "agent" && last.type === "text") {
        msgs[msgs.length - 1] = { ...last, content: last.content + action.content };
      }
      return { ...state, messages: msgs };
    }
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };
    default:
      return state;
  }
}

interface ChatContextValue {
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  onBuildComplete: ((html: string) => void) | null;
  setOnBuildComplete: (cb: ((html: string) => void) | null) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function genId(): string {
  return crypto.randomUUID();
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, {
    messages: [],
    isLoading: false,
  });
  const abortRef = useRef<AbortController | null>(null);
  const buildCallbackRef = useRef<((html: string) => void) | null>(null);

  const setOnBuildComplete = useCallback((cb: ((html: string) => void) | null) => {
    buildCallbackRef.current = cb;
  }, []);

  const addMessage = useCallback((msg: ChatMessage) => {
    dispatch({ type: "ADD_MESSAGE", message: msg });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
      type: "text",
    };
    addMessage(userMsg);
    dispatch({ type: "SET_LOADING", loading: true });

    const abortController = new AbortController();
    abortRef.current = abortController;
    let currentAgentId: string | null = null;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim() }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Connection failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventType = "";
      let pendingData = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            if (pendingData) {
              try {
                handleSSEEvent(eventType, JSON.parse(pendingData));
              } catch { /* skip */ }
            }
            eventType = line.slice(7).trim();
            pendingData = "";
          } else if (line.startsWith("data: ")) {
            pendingData += line.slice(6);
          } else if (line === "") {
            if (pendingData) {
              try {
                handleSSEEvent(eventType, JSON.parse(pendingData));
              } catch { /* skip */ }
            }
            eventType = "";
            pendingData = "";
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      addMessage({
        id: genId(),
        role: "system",
        content: "Connection lost. Please try again.",
        timestamp: Date.now(),
        type: "error",
      });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
      abortRef.current = null;
    }

    function handleSSEEvent(eventType: string, data: Record<string, unknown>) {
      switch (eventType) {
        case "status":
          addMessage({
            id: genId(),
            role: "agent",
            content: data.message as string,
            timestamp: Date.now(),
            type: "status",
          });
          break;
        case "message": {
          const content = data.content as string;
          if (!currentAgentId) {
            currentAgentId = genId();
            addMessage({
              id: currentAgentId,
              role: "agent",
              content,
              timestamp: Date.now(),
              type: "text",
            });
          } else {
            dispatch({ type: "UPDATE_LAST_AGENT", content });
          }
          break;
        }
        case "error":
          addMessage({
            id: genId(),
            role: "system",
            content: data.message as string,
            timestamp: Date.now(),
            type: "error",
          });
          break;
        case "build-complete": {
          const html = data.html as string;
          if (buildCallbackRef.current) {
            buildCallbackRef.current(html);
          }
          break;
        }
        case "question":
          addMessage({
            id: genId(),
            role: "agent",
            content: data.question as string,
            timestamp: Date.now(),
            type: "question",
            options: typeof data.options === "string" ? (data.options as string).split("|") : undefined,
          });
          break;
      }
    }
  }, [addMessage]);

  const clearMessages = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <ChatContext.Provider value={{ messages: state.messages, isLoading: state.isLoading, sendMessage, clearMessages, onBuildComplete: buildCallbackRef.current, setOnBuildComplete }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
