"use client";

import MessageList from "@/components/MessageList";
import ChatInput from "@/components/ChatInput";

export default function ChatPanel() {
  return (
    <div className="flex flex-col h-full border-r border-zinc-200 dark:border-zinc-800">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Chat</h2>
      </div>
      <MessageList />
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
        <ChatInput />
      </div>
    </div>
  );
}
