"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const updateStatus = () => setIsOffline(!navigator.onLine);

    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[100] mx-auto flex min-h-11 max-w-md items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-950 shadow-lg dark:bg-amber-950 dark:text-amber-50"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      You’re offline. Some features may be unavailable until you reconnect.
    </div>
  );
}
