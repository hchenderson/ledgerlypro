
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useUserData } from '@/hooks/use-user-data';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PlusCircle, Target, Trash2, Edit, Award, Banknote, CalendarIcon, Link2 } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Goal, Category, SubCategory } from '@/types';
import { FeatureGate } from '@/components/feature-gate';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const goalFormSchema = z.object({
  name: z.string().min(2, 'Goal name must be at least 2 characters.'),
  targetAmount: z.coerce.number().positive('Target amount must be a positive number.'),
  savedAmount: z.coerce.number().min(0, "Saved amount can't be negative.").optional(),
  targetDate: z.date().optional(),
  linkedCategoryId: z.string().optional(),
  contributionStartDate: z.date().optional(),
});

type GoalFormValues = z.infer<typeof goalFormSchema>;

function GoalDialog({ goal, onSave, children }: { goal?: Goal, onSave: (values: GoalFormValues, id?: string) => void, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { categories } = useUserData();

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      name: '',
      targetAmount: 0,
      savedAmount: 0,
      targetDate: undefined,
      linkedCategoryId: '',
      contributionStartDate: undefined,
    }
  });
  
  const expenseCategories = useMemo(() => {
    const flatten = (cats: (Category | SubCategory)[], prefix = ''): { id: string; name: string }[] => {
      return cats.reduce<{ id: string; name: string }[]>((acc, cat) => {
        const fullName = prefix ? `${prefix} > ${cat.name}` : cat.name;
        acc.push({ id: cat.id, name: fullName });
        if (cat.subCategories) {
          acc.push(...flatten(cat.subCategories, fullName));
        }
        return acc;
      }, []);
    };
    return flatten(categories.filter(c => c.type === 'expense'));
  }, [categories]);

  useEffect(() => {
    if (isOpen) {
      form.reset(goal ? {
        name: goal.name,
        targetAmount: goal.targetAmount,
        savedAmount: goal.savedAmount,
        targetDate: goal.targetDate ? new Date(goal.targetDate) : undefined,
        linkedCategoryId: goal.linkedCategoryId || '',
        contributionStartDate: goal.contributionStartDate ? new Date(goal.contributionStartDate) : undefined,
      } : {
        name: '',
        targetAmount: 0,
        savedAmount: 0,
        targetDate: undefined,
        linkedCategoryId: '',
        contributionStartDate: undefined,
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
    form.reset();
  };

  const linkedCategoryId = form.watch('linkedCategoryId');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? 'Edit' : 'Create'} Savings Goal</DialogTitle>
          <DialogDescription>
            Set a target to save for. You can optionally link a budget category to auto-track savings.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Goal Name</FormLabel><FormControl><Input placeholder="e.g., Down Payment" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="targetAmount" render={({ field }) => (<FormItem><FormLabel>Target Amount</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 10000" {...field} /></FormControl><FormMessage /></FormItem>)} />
            {!goal && (<FormField control={form.control} name="savedAmount" render={({ field }) => (<FormItem><FormLabel>Starting Amount</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 500" {...field} /></FormControl><FormMessage /></FormItem>)} />)}
            
            <FormField control={form.control} name="targetDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Target Date (Optional)</FormLabel>
                  <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date()} initialFocus /></PopoverContent></Popover>
                  <FormMessage />
                </FormItem>
              )} />

            <FormField
              control={form.control}
              name="linkedCategoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link to Budget Category (Optional)</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category to track..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {expenseCategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {linkedCategoryId && linkedCategoryId !== 'none' && (
                <FormField
                    control={form.control}
                    name="contributionStartDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Auto-Contribution Start Date</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                            {field.value ? (format(field.value, "PPP")) : (<span>Pick a start date</span>)}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                             <FormMessage />
                        </FormItem>
                    )}
                />
            )}
            
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
            toast({ 
              variant: 'destructive', 
              title: 'Invalid amount',
              description: 'Please enter a positive number.'
            });
            return;
        }
        onContribute(contributionAmount);
        toast({ 
          title: 'Contribution Added!', 
          description: `You added ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(contributionAmount)} to your goal.`
        });
        setIsOpen(false);
        setAmount('');
    };

    return (
         <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={!!goal.linkedCategoryId}>
                  <Banknote className="mr-2 h-4 w-4" /> Add Funds
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Contribution to "{goal.name}"</DialogTitle>
                    <DialogDescription>How much would you like to add to this goal?</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="contribution-amount">Amount</Label>
                    <Input 
                      id="contribution-amount" 
                      type="number" 
                      step="0.01"
                      value={amount} 
                      onChange={(e) => setAmount(e.target.value)} 
                      placeholder="e.g., 100"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleContribute();
                        }
                      }}
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleContribute}>Add Contribution</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function GoalsPageContent() {
  const { goals, addGoal, updateGoal, deleteGoal, addContributionToGoal, loading } = useUserData();
  const { toast } = useToast();

  const handleSaveGoal = async (values: GoalFormValues, id?: string) => {
    try {
      const goalData = {
        name: values.name,
        targetAmount: values.targetAmount,
        savedAmount: values.savedAmount || 0,
        targetDate: values.targetDate ? values.targetDate.toISOString() : undefined,
        linkedCategoryId: values.linkedCategoryId === 'none' ? undefined : values.linkedCategoryId,
        contributionStartDate: values.contributionStartDate ? values.contributionStartDate.toISOString() : undefined,
      };
      
      if (id) {
        await updateGoal(id, goalData);
      } else {
        await addGoal(goalData);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save goal. Please try again.',
      });
    }
  };

  const handleContribute = async (goalId: string, amount: number) => {
    try {
      await addContributionToGoal(goalId, amount);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to add contribution. Please try again.',
      });
    }
  };

  const handleDeleteGoal = async (goalId: string, goalName: string) => {
    try {
      await deleteGoal(goalId);
      toast({
        title: 'Goal Deleted',
        description: `"${goalName}" has been removed.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete goal. Please try again.',
      });
    }
  };

  if (loading) {
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
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-2 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

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
            const progress = Math.min((goal.savedAmount / goal.targetAmount) * 100, 100);
            const isCompleted = progress >= 100;
            const remaining = Math.max(goal.targetAmount - goal.savedAmount, 0);
            
            return (
              <Card key={goal.id} className={cn(isCompleted && "bg-primary/5 border-primary/20")}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 pr-2">
                          <CardTitle className="flex items-center gap-2">
                            {isCompleted && <Award className="h-5 w-5 text-primary flex-shrink-0"/>}
                            {goal.linkedCategoryId && <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0"/>}
                            <span className="truncate">{goal.name}</span>
                          </CardTitle>
                          <CardDescription>
                            {goal.targetDate 
                              ? `Target: ${format(new Date(goal.targetDate), 'MMM d, yyyy')}` 
                              : 'No target date'}
                          </CardDescription>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                          <GoalDialog goal={goal} onSave={handleSaveGoal}>
                               <Button variant="ghost" size="icon">
                                 <Edit className="h-4 w-4"/>
                               </Button>
                          </GoalDialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-red-500"/>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Goal?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{goal.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteGoal(goal.id, goal.name)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                      </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Progress value={progress} className={cn(isCompleted && "[&>div]:bg-primary")} />
                    <div className="text-sm space-y-1">
                      <p>
                        <span className="font-bold">
                          {new Intl.NumberFormat("en-US", { 
                            style: "currency", 
                            currency: "USD", 
                            maximumFractionDigits: 0 
                          }).format(goal.savedAmount)}
                        </span>
                        <span className="text-muted-foreground">
                          {' of '}
                          {new Intl.NumberFormat("en-US", { 
                            style: "currency", 
                            currency: "USD", 
                            maximumFractionDigits: 0 
                          }).format(goal.targetAmount)}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        {isCompleted 
                          ? '🎉 Goal completed!' 
                          : `${progress.toFixed(1)}% • ${new Intl.NumberFormat("en-US", { 
                              style: "currency", 
                              currency: "USD", 
                              maximumFractionDigits: 0 
                            }).format(remaining)} remaining`
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  {!isCompleted && (
                    <AddContributionDialog 
                      goal={goal} 
                      onContribute={(amount) => handleContribute(goal.id, amount)} 
                    />
                  )}
                </CardFooter>
              </Card>
            );
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
    );
}

    