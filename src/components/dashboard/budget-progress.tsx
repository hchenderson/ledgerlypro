
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
            <div className="text-center text-muted-foreground py-8">
                <Star className="mx-auto h-8 w-8 mb-2 text-yellow-400"/>
                <p>No favorited budgets to display.</p>
                <Button variant="link" asChild><Link href="/budgets">Favorite a budget</Link></Button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {budgets.map(budget => (
                <div key={budget.id}>
                    <div className="flex justify-between items-center mb-1 text-sm">
                        <span className="font-medium">{budget.categoryName}</span>
                        <span className="text-muted-foreground">
                             {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.spent)} / {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.amount)}
                        </span>
                    </div>
                    <Progress value={budget.progress} className={budget.progress > 100 ? '[&>div]:bg-destructive' : ''} />
                     <div className="flex justify-between text-xs mt-1">
                        <span className="font-medium text-muted-foreground">
                            Spent
                        </span>
                        <span className={`font-medium ${budget.remaining < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.remaining)} {budget.remaining >= 0 ? 'left' : 'over'}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

    