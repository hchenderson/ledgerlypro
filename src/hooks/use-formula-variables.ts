
"use client";

import { useMemo } from 'react';
import type { Category, SubCategory } from '@/types';
import { sanitizeForVariableName } from '@/lib/utils';

export function useFormulaVariables(categories: Category[], getBudgetDetails: () => any[]) {
    return useMemo(() => {
        const baseVars = [
            'totalIncome', 'totalExpense', 'transactionCount',
            'avgTransactionAmount', 'netIncome', 'savingsRate'
        ];

        const categoryVars = new Set<string>();
        const recurse = (cats: (Category | SubCategory)[]) => {
            (cats || []).forEach(c => {
                categoryVars.add(sanitizeForVariableName(c.name));
                if (c.subCategories) recurse(c.subCategories);
            });
        };
        recurse(categories);

        const budgetDetails = getBudgetDetails();
        const budgetVars = new Set<string>();
        budgetDetails.forEach(budget => {
            const sanitizedName = sanitizeForVariableName(budget.categoryName);
            budgetVars.add(`budget_${sanitizedName}_amount`);
            budgetVars.add(`budget_${sanitizedName}_spent`);
            budgetVars.add(`budget_${sanitizedName}_remaining`);
        });

        return [...baseVars, ...Array.from(categoryVars), ...Array.from(budgetVars)];
    }, [categories, getBudgetDetails]);
}
