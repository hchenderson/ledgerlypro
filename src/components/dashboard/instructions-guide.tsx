
"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

export function InstructionsGuide() {
  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardHeader>
        <CardTitle className="font-headline text-lg text-primary">
          Welcome to Ledgerly Pro! Here’s how to get started:
        </CardTitle>
         <CardDescription>
          Follow these steps to set up your financial dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-4">
          <CheckCircle className="h-5 w-5 text-primary mt-1 shrink-0" />
          <div>
            <h4 className="font-semibold">1. Create Your First Category</h4>
            <p className="text-sm text-muted-foreground">
              Go to the <Link href="/categories" className="underline font-medium hover:text-primary">Categories</Link> page to set up how you want to organize your finances (e.g., "Salary", "Groceries", "Utilities").
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4">
          <CheckCircle className="h-5 w-5 text-primary mt-1 shrink-0" />
          <div>
            <h4 className="font-semibold">2. Add a Transaction</h4>
            <p className="text-sm text-muted-foreground">
              Click the "New Transaction" button in the header to record your first income or expense.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4">
          <CheckCircle className="h-5 w-5 text-primary mt-1 shrink-0" />
          <div>
            <h4 className="font-semibold">3. Explore Your Dashboard</h4>
            <p className="text-sm text-muted-foreground">
              As you add more data, your charts and balances here will update automatically.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
