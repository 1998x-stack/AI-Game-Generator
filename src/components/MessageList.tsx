"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/lib/context/ChatContext";
import type { ChatMessage } from "@/types";

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.type === "status") {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-zinc-400 dark:text-zinc-500 italic px-3 py-1">
          {msg.content}
        </span>
      </div>
    );
  }

  if (msg.type === "error") {
    return (
      <div className="mx-2 my-2 p-3 bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-r-lg">
        <div className="flex items-start gap-2">
          <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase">Build Error</span>
        </div>
        <pre className="text-xs text-red-700 dark:text-red-300 mt-1 whitespace-pre-wrap font-mono">
          {msg.content}
        </pre>
      </div>
    );
  }

  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} my-2 mx-2`}>
      <div
        className={`max-w-[85%] px-4 py-2 rounded-xl text-sm ${
          isUser
            ? "bg-blue-500 text-white rounded-br-sm"
            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-bl-sm"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

export default function MessageList() {
  const { messages } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Describe a game you want to create...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} msg={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
