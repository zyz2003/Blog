"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, X } from "lucide-react";
import dynamic from "next/dynamic";

// 懒加载 ChatWindow（含 AI SDK），仅在用户打开聊天时加载，避免进入首屏 bundle。
// ChatWidget 是 Client Component，此处可用 ssr:false（根 layout 是 Server Component 不允许）。
const ChatWindow = dynamic(() => import("./ChatWindow").then(m => m.ChatWindow), {
  ssr: false,
});

/**
 * Floating chat widget button (bottom-right corner).
 * Clicking toggles the ChatWindow visibility.
 */
export function ChatWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // 后台/登录等页面不显示聊天助手（仅前台访客可见）
  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/forgot") ||
    pathname?.startsWith("/activate")
  ) {
    return null;
  }

  return (
    <>
      {/* Chat window */}
      {isOpen && <ChatWindow onClose={() => setIsOpen(false)} />}

      {/* Floating button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        aria-label={isOpen ? "关闭聊天" : "打开聊天"}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </>
  );
}
