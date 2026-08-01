"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-xl" role="alert">
      <CardHeader className="space-y-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <CardTitle>We couldn’t load this page</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your saved Firebase data has not been changed. Check your connection,
          then try loading this section again.
        </p>
        <Button onClick={reset} className="w-full sm:w-auto">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
