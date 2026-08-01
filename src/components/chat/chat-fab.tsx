
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};

const APP_ROUTE_PREFIXES = [
  "/dashboard",
  "/transactions",
  "/accounts",
  "/categories",
  "/reports",
  "/compare",
  "/budgets",
  "/goals",
  "/recurring",
  "/receipt-scanner",
  "/projections",
  "/settings",
] as const;

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatFab() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const isAppRoute = APP_ROUTE_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (!isAppRoute) return null;

  return (
    <div className="ledgerly-chat-fab fixed z-50">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            className="h-[3.25rem] w-[3.25rem] rounded-full shadow-lg motion-reduce:transition-none"
            aria-label="Open Ledgerly Assistant"
            title="Open Ledgerly Assistant"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        </SheetTrigger>

        <SheetContent
          side="right"
          className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden p-0 sm:max-w-lg [&>button:last-child]:hidden"
        >
          <SheetHeader className="shrink-0 border-b px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base">Ledgerly Assistant</SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          <div className="min-h-0 flex-1">
            <ChatBody />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ChatBody() {
  const { user } = useAuth();
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content: "Ask me about budgets, categories, or a specific transaction.",
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    bottomRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "end",
    });
  }, [messages.length, isSending]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    if (!user) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: "You must be logged in to use the chat.",
          createdAt: Date.now(),
        },
      ]);
      return;
    }

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          messages: [...messages, userMsg]
            .slice(-20)
            .map(({ role, content }) => ({ role, content })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.error || `Chat request failed with status ${res.status}`;
        throw new Error(errorMessage);
      }
      
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: data.reply ?? "No reply received.",
          createdAt: Date.now(),
        },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: e.message || "An unknown error occurred.",
          createdAt: Date.now(),
        },
      ]);
      console.error(e);
    } finally {
      setIsSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="min-h-0 flex-1" aria-label="Conversation">
        <div
          className="space-y-4 p-4"
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-busy={isSending}
        >
          {messages.map((m) => (
            <Bubble key={m.id} role={m.role} content={m.content} />
          ))}

          {isSending && (
            <div className="text-xs text-muted-foreground" role="status">
              Thinking…
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t bg-card px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message… (Enter to send)"
            className="max-h-32 min-h-11 resize-none text-base md:text-sm"
            disabled={isSending}
            aria-label="Message Ledgerly Assistant"
            enterKeyHint="send"
          />
          <Button
            onClick={() => void sendMessage()}
            disabled={isSending || !input.trim()}
            aria-label={isSending ? "Sending message" : "Send message"}
          >
            Send
          </Button>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Shift+Enter for a new line
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, content }: { role: ChatRole; content: string }) {
  const isUser = role === "user";
  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
      role="article"
      aria-label={`${isUser ? "You" : "Ledgerly Assistant"} said`}
    >
      <div
        className={cn(
          "max-w-[90%] [overflow-wrap:anywhere] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm shadow-sm sm:max-w-[85%]",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        )}
      >
        {content}
      </div>
    </div>
  );
}
