
"use client";

import { useCallback, useMemo } from 'react';
import type { Transaction, Category, SubCategory } from '@/types';
import { safeEvaluateExpression, sanitizeForVariableName } from '@/lib/utils';
import { type DateRange } from 'react-day-picker';
import { Parser } from 'expr-eval';
import type { Formula } from './use-report-settings';


export function useWidgetData(
    allTransactions: Transaction[],
    globalFilters: { dateRange: DateRange | undefined; categories: string[] },
    formulas: Formula[],
    userCategories: Category[],
    getBudgetDetails: (forDate?: Date) => any[]
) {
    const getWidgetData = useCallback((widget: any) => {
        const transactions = allTransactions.filter(t => {
            const transactionDate = new Date(t.date);
            const inDateRange = globalFilters.dateRange?.from && globalFilters.dateRange?.to ?
                (transactionDate >= globalFilters.dateRange.from && transactionDate <= globalFilters.dateRange.to) : true;
            
            const globalCategoryCheck = globalFilters.categories.length === 0 || globalFilters.categories.includes(t.category);
            const widgetCategoryCheck = widget.customFilters?.categories?.length > 0 ? 
                widget.customFilters.categories.includes(t.category) : true;
            
            return inDateRange && globalCategoryCheck && widgetCategoryCheck;
        });
        
        const dataCategories = (widget.dataCategories || []).length > 0
            ? widget.dataCategories
            : [widget.mainDataKey, widget.comparisonKey].filter(Boolean);

        const keyMapping = dataCategories.map((key: string) => ({
            original: key,
            sanitized: sanitizeForVariableName(key)
        }));

        const monthlyData: { [key: string]: any } = transactions.reduce((acc: { [key:string]: any }, transaction) => {
            try {
                const tDate = new Date(transaction.date);
                if (isNaN(tDate.getTime())) return acc;
                const monthKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
                const monthLabel = `${tDate.toLocaleString('en', { month: 'short' })} ${tDate.getFullYear()}`;

                if (!acc[monthKey]) {
                    acc[monthKey] = { monthKey, monthLabel };
                    keyMapping.forEach(mapping => (acc[monthKey][mapping.sanitized] = 0));
                }

                keyMapping.forEach(mapping => {
                    if (mapping.original === transaction.type) {
                        acc[monthKey][mapping.sanitized] = (acc[monthKey][mapping.sanitized] || 0) + transaction.amount;
                    } else if (mapping.original === transaction.category) {
                        acc[monthKey][mapping.sanitized] = (acc[monthKey][mapping.sanitized] || 0) + transaction.amount;
                    }
                });
            } catch (e) {
                console.error("Error processing transaction for widget data:", transaction, e);
            }
            return acc;
        }, {});
        
        const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

        const categoryTotals = transactions.reduce((acc, t) => {
            if (t.category) {
                const sanitizedCategory = sanitizeForVariableName(t.category);
                if (!acc[sanitizedCategory]) {
                    acc[sanitizedCategory] = 0;
                }
                acc[sanitizedCategory] += t.amount;
            }
            return acc;
        }, {} as Record<string, number>);
        
        const dateForBudgets = globalFilters.dateRange?.to || new Date();
        const budgetDetails = getBudgetDetails(dateForBudgets);
        const budgetTotals = budgetDetails.reduce((acc, budget) => {
            const sanitizedName = sanitizeForVariableName(budget.categoryName);
            acc[`budget_${sanitizedName}_amount`] = budget.amount;
            acc[`budget_${sanitizedName}_spent`] = budget.spent;
            acc[`budget_${sanitizedName}_remaining`] = budget.remaining;
            return acc;
        }, {} as Record<string, number>);
        
        const kpis: Record<string, number> = {
            [sanitizeForVariableName('totalIncome')]: totalIncome,
            [sanitizeForVariableName('totalExpense')]: totalExpense,
            [sanitizeForVariableName('netIncome')]: totalIncome - totalExpense,
            [sanitizeForVariableName('savingsRate')]: totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0,
            [sanitizeForVariableName('transactionCount')]: transactions.length,
            [sanitizeForVariableName('avgTransactionAmount')]: transactions.reduce((sum, t) => sum + t.amount, 0) / (transactions.length || 1),
            ...categoryTotals,
            ...budgetTotals,
        };
        
        if (widget.type === 'metric') {
            const formula = formulas.find(f => f.id === widget.formulaId);
            if (formula && formula.expression) {
                try {
                    const parser = new Parser();
                    const ast = parser.parse(formula.expression);
                    const formulaVariables = ast.variables();
                    
                    formulaVariables.forEach(varName => {
                        if (!(varName in kpis)) {
                            console.warn(`Adding missing formula variable '${varName}' as 0`);
                            kpis[varName] = 0;
                        }
                    });

                    const value = safeEvaluateExpression(formula.expression, kpis);
                    return { kpis, data: [{ name: formula.name, value, formula: formula.expression }], formulas };
                } catch (error: any) {
                    console.error(`Error evaluating formula "${formula.name}":`, error.message);
                    return { kpis, data: [{ name: formula.name, value: null, formula: formula.expression }], formulas };
                }
            } else if (widget.mainDataKey && kpis.hasOwnProperty(widget.mainDataKey)) {
                const value = kpis[widget.mainDataKey as keyof typeof kpis];
                return { kpis, data: [{ name: widget.title, value }], formulas };
            }
            return { kpis, data: null, formulas };
        }
        
        const monthly = Object.values(monthlyData)
            .sort((a: any, b: any) => a.monthKey.localeCompare(b.monthKey))
            .map((m: any) => ({ month: m.monthLabel, ...m }));
        
        return { kpis, data: monthly, dataKeys: keyMapping.map(m => m.sanitized), originalDataKeys: keyMapping.map(m => m.original), formulas };
    }, [allTransactions, globalFilters, formulas, userCategories, getBudgetDetails]);

    return { getWidgetData };
}
