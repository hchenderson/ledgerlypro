
"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

export function InstructionsGuide() {
  return (
    <Card className="min-w-0 overflow-hidden border-primary/20 bg-primary/5">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="break-words font-headline text-lg text-primary">
          Welcome to Ledgerly Pro! Here’s how to get started:
        </CardTitle>
         <CardDescription>
          Follow these steps to set up your financial dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <CheckCircle className="h-5 w-5 text-primary mt-1 shrink-0" />
          <div className="min-w-0">
            <h4 className="font-semibold">1. Review Your Accounts</h4>
            <p className="text-sm text-muted-foreground">
              Open <Link href="/accounts" className="underline font-medium hover:text-primary">Accounts</Link> to name your primary account or add checking, savings, card, and cash accounts.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 sm:gap-4">
          <CheckCircle className="h-5 w-5 text-primary mt-1 shrink-0" />
          <div className="min-w-0">
            <h4 className="font-semibold">2. Create Your First Category</h4>
            <p className="text-sm text-muted-foreground">
              Go to the <Link href="/categories" className="underline font-medium hover:text-primary">Categories</Link> page to set up how you want to organize your finances (e.g., "Salary", "Groceries", "Utilities").
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 sm:gap-4">
          <CheckCircle className="h-5 w-5 text-primary mt-1 shrink-0" />
          <div className="min-w-0">
            <h4 className="font-semibold">3. Add a Transaction</h4>
            <p className="text-sm text-muted-foreground">
              Use the "New Transaction" action to record your first income or expense.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 sm:gap-4">
          <CheckCircle className="h-5 w-5 text-primary mt-1 shrink-0" />
          <div className="min-w-0">
            <h4 className="font-semibold">4. Explore Your Dashboard</h4>
            <p className="text-sm text-muted-foreground">
              As you add more data, your charts and balances here will update automatically.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
