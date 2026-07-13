
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
    // Auto-scroll to bottom on new messages
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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
          messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })),
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
    <Card className="overflow-hidden">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Ledgerly Assistant
        </CardTitle>
        <CardDescription>
          Ask questions about your transactions, budgets, categories, and reports.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <div className="border-t">
          <ScrollArea className="h-[60vh]">
            <div className="space-y-4 p-4">
              {messages.map((m) => (
                <MessageBubble key={m.id} role={m.role} content={m.content} />
              ))}

              {isSending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking…
                </div>
              )}

              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask something… (Enter to send, Shift+Enter for a new line)"
                className="min-h-[44px] resize-none"
                disabled={isSending}
              />
              <Button onClick={() => void sendMessage()} disabled={isSending || !input.trim()}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
    <div className={cn("flex w-full gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border bg-background">
          <Sparkles className="h-4 w-4" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <div className="whitespace-pre-wrap">{content}</div>
      </div>

      {isUser && (
        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border bg-background">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
