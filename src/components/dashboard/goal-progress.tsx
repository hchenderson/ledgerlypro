
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
            <div className="text-center text-muted-foreground py-8">
                <Target className="mx-auto h-8 w-8 mb-2"/>
                <p>No savings goals created.</p>
                <Button variant="link" asChild><Link href="/goals">Create your first goal</Link></Button>
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
                    <div key={goal.id}>
                        <div className="flex justify-between items-center mb-1">
                            <div>
                                <span className="font-medium">{goal.name}</span>
                                {goal.targetDate && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Flag className="h-3 w-3" /> Target: {format(new Date(goal.targetDate), 'MMM yyyy')}
                                    </p>
                                )}
                            </div>
                            <span className="text-sm text-muted-foreground">
                                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(goal.savedAmount)}
                            </span>
                        </div>
                        <Progress value={progress} />
                        <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                            <span>{progress.toFixed(0)}% complete</span>
                            <span>
                                Goal: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(goal.targetAmount)}
                            </span>
                        </div>
                    </div>
                )
            })}
             {sortedGoals.length > 3 && (
                <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href="/goals">View All Goals</Link>
                </Button>
            )}
        </div>
    );
}
