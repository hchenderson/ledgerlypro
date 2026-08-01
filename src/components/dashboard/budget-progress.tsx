
"use client";

import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { Button } from '../ui/button';
import { Star } from 'lucide-react';

interface BudgetProgressProps {
    budgets: any[];
}

export function BudgetProgress({ budgets }: BudgetProgressProps) {
    if (budgets.length === 0) {
        return (
            <div className="py-8 text-center text-muted-foreground">
                <Star className="mx-auto h-8 w-8 mb-2 text-yellow-400"/>
                <p>No favorited budgets to display.</p>
                <Button variant="link" className="min-h-11" asChild><Link href="/budgets">Favorite a budget</Link></Button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {budgets.map(budget => (
                <div key={budget.id} className="min-w-0">
                    <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                        <span className="truncate font-medium" title={budget.categoryName}>{budget.categoryName}</span>
                        <span className="max-w-36 truncate text-sm tabular-nums text-muted-foreground" title={new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.spent)}>
                             {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.spent)}
                        </span>
                    </div>
                    <Progress value={budget.progress} className={budget.progress > 100 ? '[&>div]:bg-destructive' : ''} />
                     <div className="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="min-w-0">
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.amount)} / {budget.period === 'yearly' ? 'year' : 'month'}
                        </span>
                        <span className={`font-medium tabular-nums ${budget.remaining < 0 ? 'text-destructive' : ''}`}>
                          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.remaining)} {budget.remaining >= 0 ? 'left' : 'over'}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
