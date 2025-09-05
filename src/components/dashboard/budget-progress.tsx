
"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import { type Budget, type Transaction, type Category, SubCategory } from '@/types';
import { Progress } from '@/components/ui/progress';
import { Button } from '../ui/button';
import { Target, Star } from 'lucide-react';

interface BudgetProgressProps {
    budgets: Budget[];
    transactions: Transaction[];
    categories: Category[];
}

export function BudgetProgress({ budgets, transactions, categories }: BudgetProgressProps) {

    const findCategoryById = (id: string, cats: (Category | SubCategory)[]): (Category | SubCategory | undefined) => {
        for (const cat of cats) {
            if (cat.id === id) return cat;
            if (cat.subCategories) {
                const found = findCategoryById(id, cat.subCategories);
                if (found) return found;
            }
        }
        return undefined;
    }

    const getAllSubCategoryNames = (category: Category | SubCategory): string[] => {
        let names = [category.name];
        if (category.subCategories) {
            category.subCategories.forEach(sub => {
                names = [...names, ...getAllSubCategoryNames(sub)];
            });
        }
        return names;
    }

    const budgetDetails = useMemo(() => {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        return budgets.map(budget => {
            const category = findCategoryById(budget.categoryId, categories);
            
            let categoryName = "Unknown Category";
            const targetCategoryNames: string[] = [];

            if(category) {
              categoryName = category.name;
              const rootCategoryForBudget = findCategoryById(budget.categoryId, categories);
              if (rootCategoryForBudget) {
                targetCategoryNames.push(...getAllSubCategoryNames(rootCategoryForBudget));
              }
            }

            const spent = transactions
                .filter(t =>
                    t.type === 'expense' &&
                    targetCategoryNames.some(catName => catName === t.category) &&
                    new Date(t.date).getMonth() === currentMonth &&
                    new Date(t.date).getFullYear() === currentYear
                )
                .reduce((sum, t) => sum + t.amount, 0);

            const remaining = budget.amount - spent;
            const progress = (spent / budget.amount) * 100;

            return {
                ...budget,
                categoryName,
                spent,
                remaining,
                progress,
            };
        });
    }, [budgets, transactions, categories]);

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
            {budgetDetails.map(budget => (
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
