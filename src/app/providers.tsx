"use client";

import dynamic from "next/dynamic";
import { ThemeProvider } from "next-themes";

import { NetworkStatus } from "@/components/network-status";
import { Toaster } from "@/components/ui/toaster";
import { useAuth, AuthProvider } from "@/hooks/use-auth";

const ChatFab = dynamic(
  () => import("@/components/chat/chat-fab").then((module) => module.ChatFab),
  {
    ssr: false,
  },
);

function AuthenticatedChat() {
  const { user } = useAuth();

  return user ? <ChatFab /> : null;
}

export function AppProviders({
  children,
  enableChat = false,
}: {
  children: React.ReactNode;
  enableChat?: boolean;
}) {
  return (
    <AuthProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <NetworkStatus />
        <Toaster />
        {enableChat ? <AuthenticatedChat /> : null}
      </ThemeProvider>
    </AuthProvider>
  );
}
