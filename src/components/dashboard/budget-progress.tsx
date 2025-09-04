
"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import { type Budget, type Transaction, type Category } from '@/types';
import { Progress } from '@/components/ui/progress';
import { Button } from '../ui/button';
import { Target } from 'lucide-react';

interface BudgetProgressProps {
    budgets: Budget[];
    transactions: Transaction[];
    categories: Category[];
}

export function BudgetProgress({ budgets, transactions, categories }: BudgetProgressProps) {
    const budgetDetails = useMemo(() => {
        return budgets.map(budget => {
            const category = categories.find(c => c.id === budget.categoryId);
            const categoryName = category?.name || 'Unknown';
            const allCategoryNames = category ? [category.name, ...(category.subCategories?.map(sc => sc.name) || [])] : [];

            const spent = transactions
                .filter(t =>
                    t.type === 'expense' &&
                    allCategoryNames.includes(t.category) &&
                    new Date(t.date).getMonth() === new Date().getMonth() &&
                    new Date(t.date).getFullYear() === new Date().getFullYear()
                )
                .reduce((sum, t) => sum + t.amount, 0);

            const progress = Math.min((spent / budget.amount) * 100, 100);

            return {
                ...budget,
                categoryName,
                spent,
                progress,
            };
        });
    }, [budgets, transactions, categories]);

    if (budgets.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-8">
                <Target className="mx-auto h-8 w-8 mb-2"/>
                <p>No budgets set for this month.</p>
                <Button variant="link" asChild><Link href="/budgets">Create a budget</Link></Button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {budgetDetails.map(budget => (
                <div key={budget.id}>
                    <div className="flex justify-between items-center mb-1 text-sm">
                        <span className="font-medium">{budget.categoryName}</span>
                        <span className="text-muted-foreground">
                             {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.spent)} / {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.amount)}
                        </span>
                    </div>
                    <Progress value={budget.progress} />
                </div>
            ))}
        </div>
    );
}
