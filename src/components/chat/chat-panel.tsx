
"use client";

import * as React from "react";
import { Send, Loader2, Sparkles, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  // Simple client id generator; replace with crypto.randomUUID() if you want.
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatPanel() {
  const { user } = useAuth();
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content:
        "Hi! Ask me about your spending, budgets, or a specific transaction (e.g., “Find Check 1774”).",
      createdAt: Date.now(),
    },
  ]);

  const [input, setInput] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scrollRef.current?.scrollIntoView({
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

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: data.reply ?? "I didn’t get a response back. Try again.",
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: err.message || "An unknown error occurred.",
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      console.error(err);
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
    <Card className="flex h-[calc(100dvh-9.75rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-72 flex-col overflow-hidden md:h-[min(46rem,calc(100dvh-10rem))]">
      <CardHeader className="shrink-0 space-y-1 p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Sparkles className="h-5 w-5" />
          Ledgerly Assistant
        </CardTitle>
        <CardDescription>
          Ask questions about your transactions, budgets, categories, and reports.
        </CardDescription>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 p-0">
        <div className="flex h-full min-h-0 flex-col border-t">
          <ScrollArea
            className="min-h-0 flex-1"
            aria-label="Conversation"
          >
            <div
              className="space-y-4 p-3 sm:p-4"
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
              aria-busy={isSending}
            >
              {messages.map((m) => (
                <MessageBubble key={m.id} role={m.role} content={m.content} />
              ))}

              {isSending && (
                <div
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  role="status"
                >
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                  Thinking…
                </div>
              )}

              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="shrink-0 border-t bg-card p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask something… (Enter to send, Shift+Enter for a new line)"
                className="max-h-32 min-h-11 resize-none text-base md:text-sm"
                disabled={isSending}
                aria-label="Message Ledgerly Assistant"
                enterKeyHint="send"
              />
              <Button
                size="icon"
                onClick={() => void sendMessage()}
                disabled={isSending || !input.trim()}
                aria-label={isSending ? "Sending message" : "Send message"}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              Tip: Try “How much did I spend on groceries last month?”
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MessageBubble({ role, content }: { role: ChatRole; content: string }) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex w-full gap-2 sm:gap-3",
        isUser ? "justify-end" : "justify-start",
      )}
      role="article"
      aria-label={`${isUser ? "You" : "Ledgerly Assistant"} said`}
    >
      {!isUser && (
        <div className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background min-[360px]:flex">
          <Sparkles className="h-4 w-4" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[90%] [overflow-wrap:anywhere] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm sm:max-w-[85%] sm:px-4",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <div className="whitespace-pre-wrap">{content}</div>
      </div>

      {isUser && (
        <div className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background min-[360px]:flex">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
