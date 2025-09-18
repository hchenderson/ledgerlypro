
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCashFlowProjections, GetCashFlowProjectionsInput } from "@/ai/flows/cash-flow-projections";
import { useUserData } from "@/hooks/use-user-data";
import { Rocket, Sparkles, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FeatureGate } from "@/components/feature-gate";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

function ProjectionsPageContent() {
  const [loading, setLoading] = useState(false);
  const [projection, setProjection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState("");
  const { allTransactions } = useUserData();

  const handleGenerateProjection = async () => {
    setLoading(true);
    setError(null);
    setProjection(null);

    if (allTransactions.length === 0) {
        setError("You need at least one transaction to generate a projection.");
        setLoading(false);
        return;
    }

    try {
      const input: GetCashFlowProjectionsInput = {
        historicalData: JSON.stringify(allTransactions),
        userPrompt: userPrompt || undefined,
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
          AI Financial Analysis
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Leverage AI to forecast your future or ask specific questions about your transaction history.
        </p>
      </div>
      
       <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Verify AI Output</AlertTitle>
          <AlertDescription>
            AI can make mistakes. Please review the generated analysis carefully and verify its accuracy against your own records.
          </AlertDescription>
        </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Generate Your Analysis</CardTitle>
          <CardDescription>Enter a specific question or leave it blank for a general cash flow projection.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="user-prompt">Your Question (Optional)</Label>
                <Textarea
                    id="user-prompt"
                    placeholder="e.g., 'What are my top 3 spending categories this month?' or 'How does my income compare to last month?'"
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    rows={3}
                />
            </div>
          <Button onClick={handleGenerateProjection} disabled={loading} size="lg" className="w-full">
            {loading ? (
              "Analyzing Data..."
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Analysis
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
              Your AI-Powered Analysis
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

export default function ProjectionsPage() {
    return (
        <FeatureGate>
            <ProjectionsPageContent />
        </FeatureGate>
    )
}
