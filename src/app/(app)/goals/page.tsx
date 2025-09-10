
"use client";

import { useState, useEffect } from 'react';
import { useUserData } from '@/hooks/use-user-data';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PlusCircle, Target, Trash2, Edit, Flag, Award, Banknote, CalendarIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Goal } from '@/types';
import { FeatureGate } from '@/components/feature-gate';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

const goalFormSchema = z.object({
  name: z.string().min(2, 'Goal name must be at least 2 characters.'),
  targetAmount: z.coerce.number().positive('Target amount must be a positive number.'),
  savedAmount: z.coerce.number().min(0, "Saved amount can't be negative.").optional(),
  targetDate: z.date().optional(),
});

type GoalFormValues = z.infer<typeof goalFormSchema>;

function GoalDialog({ goal, onSave, children }: { goal?: Goal, onSave: (values: GoalFormValues, id?: string) => void, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: goal ? {
      ...goal,
      targetDate: goal.targetDate ? new Date(goal.targetDate) : undefined,
    } : {
      name: '',
      targetAmount: 0,
      savedAmount: 0,
    }
  });

  useEffect(() => {
    if (isOpen) {
      form.reset(goal ? {
        ...goal,
        targetDate: goal.targetDate ? new Date(goal.targetDate) : undefined,
      } : {
        name: '',
        targetAmount: 0,
        savedAmount: 0,
        targetDate: undefined,
      });
    }
  }, [isOpen, goal, form]);

  const onSubmit = (data: GoalFormValues) => {
    onSave(data, goal?.id);
    toast({
      title: goal ? 'Goal Updated' : 'Goal Created',
      description: `Your goal "${data.name}" has been successfully saved.`,
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? 'Edit' : 'Create'} Savings Goal</DialogTitle>
          <DialogDescription>
            Set a target to save for. Track your progress over time.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Goal Name</FormLabel><FormControl><Input placeholder="e.g., Down Payment" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="targetAmount" render={({ field }) => (<FormItem><FormLabel>Target Amount</FormLabel><FormControl><Input type="number" placeholder="e.g., 10000" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="savedAmount" render={({ field }) => (<FormItem><FormLabel>Starting Amount</FormLabel><FormControl><Input type="number" placeholder="e.g., 500" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="targetDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Target Date (Optional)</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit">Save Goal</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AddContributionDialog({ goal, onContribute }: { goal: Goal, onContribute: (amount: number) => void}) {
    const [isOpen, setIsOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const { toast } = useToast();

    const handleContribute = () => {
        const contributionAmount = parseFloat(amount);
        if (isNaN(contributionAmount) || contributionAmount <= 0) {
            toast({ variant: 'destructive', title: 'Invalid amount' });
            return;
        }
        onContribute(contributionAmount);
        toast({ title: 'Contribution Added!', description: `You added ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(contributionAmount)} to your goal.`})
        setIsOpen(false);
        setAmount('');
    }

    return (
         <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Banknote className="mr-2 h-4 w-4" /> Add Funds</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Contribution to "{goal.name}"</DialogTitle>
                    <DialogDescription>How much would you like to add to this goal?</DialogDescription>
                </DialogHeader>
                 <div className="space-y-2">
                    <Label htmlFor="contribution-amount">Amount</Label>
                    <Input id="contribution-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g., 100" />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleContribute}>Add Contribution</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function GoalsPageContent() {
  const { goals, addGoal, updateGoal, deleteGoal, addContributionToGoal, loading } = useUserData();

  const handleSaveGoal = (values: GoalFormValues, id?: string) => {
    const goalData = {
        ...values,
        targetDate: values.targetDate ? values.targetDate.toISOString() : undefined,
        savedAmount: values.savedAmount || 0,
    }
    if (id) {
        updateGoal(id, goalData);
    } else {
        addGoal(goalData);
    }
  };

  const handleContribute = (goalId: string, amount: number) => {
    addContributionToGoal(goalId, amount);
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight font-headline flex items-center gap-2">
            <Target/> Savings Goals
          </h2>
          <p className="text-muted-foreground">
            Set and track your long-term savings goals.
          </p>
        </div>
        <GoalDialog onSave={handleSaveGoal}>
             <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Goal
            </Button>
        </GoalDialog>
      </div>

      {goals.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
             <CardHeader className="text-center">
                 <Target className="mx-auto h-12 w-12 text-muted-foreground" />
                <CardTitle className="mt-4">No Goals Created</CardTitle>
                <CardDescription>Get started by creating your first savings goal.</CardDescription>
            </CardHeader>
            <CardContent>
                <GoalDialog onSave={handleSaveGoal}>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create a Goal
                    </Button>
                </GoalDialog>
            </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map(goal => {
            const progress = (goal.savedAmount / goal.targetAmount) * 100;
            const isCompleted = progress >= 100;
            return (
              <Card key={goal.id} className={cn(isCompleted && "bg-primary/5 border-primary/20")}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                      <div>
                          <CardTitle className="flex items-center gap-2">
                            {isCompleted && <Award className="h-5 w-5 text-primary"/>}
                            {goal.name}
                          </CardTitle>
                          <CardDescription>
                               {goal.targetDate ? `Target: ${format(new Date(goal.targetDate), 'PPP')}` : 'No target date'}
                          </CardDescription>
                      </div>
                      <div className="flex gap-1">
                          <GoalDialog goal={goal} onSave={handleSaveGoal}>
                               <Button variant="ghost" size="icon"><Edit className="h-4 w-4"/></Button>
                          </GoalDialog>
                           <Button variant="ghost" size="icon" onClick={() => deleteGoal(goal.id)}>
                              <Trash2 className="h-4 w-4 text-red-500"/>
                          </Button>
                      </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Progress value={progress} />
                    <div className="text-sm">
                      <p>
                        <span className="font-bold">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(goal.savedAmount)}</span>
                        <span className="text-muted-foreground"> of {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(goal.targetAmount)}
                        </span>
                      </p>
                       <p className="text-muted-foreground">{progress.toFixed(1)}% funded</p>
                    </div>
                  </div>
                </CardContent>
                 <CardFooter>
                    <AddContributionDialog goal={goal} onContribute={(amount) => handleContribute(goal.id, amount)} />
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  );
}

export default function GoalsPage() {
    return (
        <FeatureGate>
            <GoalsPageContent />
        </FeatureGate>
    )
}
