"use client";

import { useState } from "react";
import { Bot, X } from "lucide-react";
import { ChatWindow } from "./ChatWindow";

/**
 * Floating chat widget button (bottom-right corner).
 * Clicking toggles the ChatWindow visibility.
 */
export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Chat window */}
      {isOpen && <ChatWindow onClose={() => setIsOpen(false)} />}

      {/* Floating button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-800 text-white shadow-lg transition-transform hover:scale-105 dark:bg-neutral-200 dark:text-neutral-800"
        aria-label={isOpen ? "关闭聊天" : "打开聊天"}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </>
  );
}
