
"use client";

import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { Button } from '../ui/button';
import { Target, Flag } from 'lucide-react';
import type { Goal } from '@/types';
import { format } from 'date-fns';

interface GoalProgressProps {
    goals: Goal[];
}

export function GoalProgress({ goals }: GoalProgressProps) {
    if (goals.length === 0) {
        return (
            <div className="py-8 text-center text-muted-foreground">
                <Target className="mx-auto h-8 w-8 mb-2"/>
                <p>No savings goals created.</p>
                <Button variant="link" className="min-h-11" asChild><Link href="/goals">Create your first goal</Link></Button>
            </div>
        )
    }
    
    const sortedGoals = [...goals].sort((a,b) => {
        const progressA = (a.savedAmount / a.targetAmount) * 100;
        const progressB = (b.savedAmount / b.targetAmount) * 100;
        return progressB - progressA;
    });

    return (
        <div className="space-y-4">
            {sortedGoals.slice(0, 3).map(goal => {
                const progress = (goal.savedAmount / goal.targetAmount) * 100;
                return (
                    <div key={goal.id} className="min-w-0">
                        <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                            <div className="min-w-0">
                                <span className="block truncate font-medium" title={goal.name}>{goal.name}</span>
                                {goal.targetDate && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Flag className="h-3 w-3 shrink-0" /> <span className="truncate">Target: {format(new Date(goal.targetDate), 'MMM yyyy')}</span>
                                    </p>
                                )}
                            </div>
                            <span className="max-w-32 truncate text-sm tabular-nums text-muted-foreground" title={new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(goal.savedAmount)}>
                                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(goal.savedAmount)}
                            </span>
                        </div>
                        <Progress value={progress} />
                        <div className="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{progress.toFixed(0)}% complete</span>
                            <span className="tabular-nums">
                                Goal: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(goal.targetAmount)}
                            </span>
                        </div>
                    </div>
                )
            })}
             {sortedGoals.length > 3 && (
                <Button variant="outline" size="sm" className="h-11 w-full sm:h-9" asChild>
                    <Link href="/goals">View All Goals</Link>
                </Button>
            )}
        </div>
    );
}
