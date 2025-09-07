
"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import type { Category, Transaction } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '../ui/button';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '../ui/progress';

interface FavoriteCategoriesProps {
    categories: Category[];
    transactions: Transaction[];
}

export function FavoriteCategories({ categories, transactions }: FavoriteCategoriesProps) {
    const favoriteCategories = useMemo(() => {
        return categories.filter(c => (c as any).isFavorite); // Cast to any to check for property
    }, [categories]);

    const categoryDetails = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        return favoriteCategories.map(cat => {
            const allCategoryNames = [cat.name, ...(cat.subCategories?.map(sc => sc.name) || [])];
            
            const total = transactions
                .filter(t => 
                    allCategoryNames.includes(t.category) &&
                    new Date(t.date).getMonth() === currentMonth &&
                    new Date(t.date).getFullYear() === currentYear &&
                    t.type === cat.type
                )
                .reduce((sum, t) => sum + t.amount, 0);

            return {
                ...cat,
                currentMonthTotal: total,
            };
        });
    }, [favoriteCategories, transactions]);

    if (favoriteCategories.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-8">
                <Star className="mx-auto h-8 w-8 mb-2 text-yellow-400"/>
                <p>No favorite categories yet.</p>
                <Button variant="link" asChild><Link href="/categories">Add some favorites</Link></Button>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryDetails.map(cat => (
                <Card key={cat.id}>
                    <CardHeader className="pb-2">
                         <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-medium">{cat.name}</CardTitle>
                            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className={cn("text-2xl font-bold font-code", cat.type === 'income' ? 'text-emerald-500' : 'text-red-500')}>
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cat.currentMonthTotal)}
                        </p>
                        <p className="text-xs text-muted-foreground">spent this month</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
