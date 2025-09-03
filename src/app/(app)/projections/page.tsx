"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCashFlowProjections, GetCashFlowProjectionsInput } from "@/ai/flows/cash-flow-projections";
import { mockTransactions } from "@/lib/data";
import { Rocket, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ProjectionsPage() {
  const [loading, setLoading] = useState(false);
  const [projection, setProjection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateProjection = async () => {
    setLoading(true);
    setError(null);
    setProjection(null);

    try {
      const input: GetCashFlowProjectionsInput = {
        historicalData: JSON.stringify(mockTransactions),
      };
      const result = await getCashFlowProjections(input);
      setProjection(result.projection);
    } catch (e) {
      setError("Failed to generate projection. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <Rocket className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 font-headline text-3xl font-bold tracking-tight sm:text-4xl">
          AI Cash Flow Projections
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Leverage the power of AI to forecast your financial future based on your transaction history.
        </p>
      </div>

      <Card className="text-center">
        <CardHeader>
          <CardTitle>Generate Your Projection</CardTitle>
          <CardDescription>Click the button below to analyze your data and create a projection.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGenerateProjection} disabled={loading} size="lg">
            {loading ? (
              "Analyzing Data..."
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Projection
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>Generating...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {projection && (
        <Card className="bg-primary/5">
          <CardHeader>
             <CardTitle className="flex items-center gap-2">
              <Sparkles className="text-primary"/>
              Your AI-Powered Projection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap rounded-md bg-background/50 p-4 border">
              {projection}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
