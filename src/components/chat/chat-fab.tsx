
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

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatFab() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // Optional: don’t show floating widget on the dedicated /chat page
  if (pathname === "/chat") return null;

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg"
            aria-label="Open chat"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        </SheetTrigger>

        <SheetContent side="right" className="w-full sm:max-w-lg p-0">
          <SheetHeader className="border-b px-4 py-3">
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

          <ChatBody />
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
    <div className="flex h-[calc(100dvh-56px)] flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {messages.map((m) => (
            <Bubble key={m.id} role={m.role} content={m.content} />
          ))}

          {isSending && (
            <div className="text-xs text-muted-foreground">Thinking…</div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message… (Enter to send)"
            className="min-h-[44px] resize-none"
            disabled={isSending}
          />
          <Button onClick={() => void sendMessage()} disabled={isSending || !input.trim()}>
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
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm shadow-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        )}
      >
        {content}
      </div>
    </div>
  );
}
