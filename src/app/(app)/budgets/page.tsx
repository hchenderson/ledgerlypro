
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useUserData } from '@/hooks/use-user-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PlusCircle, Target, Trash2, Edit, Star, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Budget, Category, SubCategory } from '@/types';
import { FeatureGate } from '@/components/feature-gate';
import { cn } from '@/lib/utils';
import { addMonths, subMonths, format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const budgetFormSchema = z.object({
  categoryId: z.string().min(1, 'Please select a category.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  period: z.enum(['monthly', 'yearly']),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

function BudgetDialog({ budget, onSave, children }: { budget?: Budget, onSave: (values: BudgetFormValues, id?: string) => void, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { categories, budgets } = useUserData();
  const { toast } = useToast();

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: budget ? {
      categoryId: budget.categoryId,
      amount: budget.amount,
      period: budget.period,
    } : {
      categoryId: '',
      amount: 0,
      period: 'monthly',
    }
  });

  useEffect(() => {
    if (isOpen) {
        form.reset(budget ? {
          categoryId: budget.categoryId,
          amount: budget.amount,
          period: budget.period,
        } : {
          categoryId: '',
          amount: 0,
          period: 'monthly',
        });
    }
  }, [isOpen, budget, form]);

  const onSubmit = (data: BudgetFormValues) => {
    onSave(data, budget?.id);
    const categoryName = categories.find(c => c.id === data.categoryId)?.name || 'the';
    toast({
      title: budget ? 'Budget Updated' : 'Budget Created',
      description: `Your budget for the "${categoryName}" category has been successfully saved.`,
    });
    setIsOpen(false);
  };

  const expenseCategories = useMemo(() => {
      const budgetedCategoryIds = new Set(budgets.filter(b => b.id !== budget?.id).map(b => b.categoryId));
      
      const flatten = (cats: (Category | SubCategory)[]): { id: string; name: string, disabled: boolean }[] => {
          return cats.reduce<{ id: string; name: string, disabled: boolean }[]>((acc, cat) => {
              const isDisabled = budgetedCategoryIds.has(cat.id);
              acc.push({ id: cat.id, name: cat.name, disabled: isDisabled });
              if (cat.subCategories) {
                  acc.push(...flatten(cat.subCategories));
              }
              return acc;
          }, []);
      };
      
      const findCategory = (id: string, cats: (Category|SubCategory)[]): Category | SubCategory | undefined => {
          for (const cat of cats) {
              if (cat.id === id) return cat;
              if (cat.subCategories) {
                  const found = findCategory(id, cat.subCategories);
                  if (found) return found;
              }
          }
          return undefined;
      };

      const getExpenseCategories = (cats: Category[]) => {
          let expenseCats: (Category | SubCategory)[] = [];
          cats.forEach(c => {
              if (c.type === 'expense') {
                  expenseCats.push(c);
              }
          });
          return expenseCats;
      }
      
      return flatten(getExpenseCategories(categories));
  }, [categories, budgets, budget]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{budget ? 'Edit' : 'Create'} Budget</DialogTitle>
          <DialogDescription>
            Set a spending limit for a specific category.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!budget}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an expense category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {expenseCategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id} disabled={cat.disabled && cat.id !== budget?.categoryId}>{cat.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Budget Amount</FormLabel><FormControl><Input type="number" placeholder="e.g., 500" {...field} /></FormControl><FormMessage /></FormItem>)} />
            
            <FormField
              control={form.control}
              name="period"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Period</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                      disabled={!!budget}
                    >
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <RadioGroupItem value="monthly" />
                        </FormControl>
                        <FormLabel className="font-normal">Monthly</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <RadioGroupItem value="yearly" />
                        </FormControl>
                        <FormLabel className="font-normal">Yearly</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit">Save Budget</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


function BudgetsPageContent() {
  const { addBudget, updateBudget, deleteBudget, toggleFavoriteBudget, loading, getBudgetDetails } = useUserData();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const handleSaveBudget = (values: BudgetFormValues, id?: string) => {
    if (id) {
        updateBudget(id, values);
    } else {
        addBudget({
            ...values,
            isFavorite: false,
        });
    }
  };

  const budgetDetails = useMemo(() => {
    return getBudgetDetails(selectedDate);
  }, [getBudgetDetails, selectedDate]);


  const handlePrevMonth = () => {
    setSelectedDate(prev => subMonths(prev, 1));
  }
  
  const handleNextMonth = () => {
    setSelectedDate(prev => addMonths(prev, 1));
  }
  
  if (loading) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight font-headline flex items-center gap-2">
            <Target/> Budgets
          </h2>
          <p className="text-muted-foreground">
            Track your spending against your goals.
          </p>
        </div>
        <BudgetDialog onSave={handleSaveBudget}>
             <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Budget
            </Button>
        </BudgetDialog>
      </div>

       <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Viewing Budgets For</CardTitle>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-semibold text-lg w-36 text-center">{format(selectedDate, "MMMM yyyy")}</span>
                    <Button variant="outline" size="icon" onClick={handleNextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
       </Card>

      {budgetDetails.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
             <CardHeader className="text-center">
                 <Target className="mx-auto h-12 w-12 text-muted-foreground" />
                <CardTitle className="mt-4">No Budgets Created</CardTitle>
                <CardDescription>Get started by creating your first budget.</CardDescription>
            </CardHeader>
            <CardContent>
                <BudgetDialog onSave={handleSaveBudget}>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create a Budget
                    </Button>
                </BudgetDialog>
            </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgetDetails.map(budget => (
            <Card key={budget.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>{budget.categoryName}</CardTitle>
                        <CardDescription>
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.amount)} / {budget.period === 'yearly' ? 'year' : 'month'}
                        </CardDescription>
                    </div>
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => toggleFavoriteBudget(budget.id)}>
                            <Star className={cn("h-4 w-4", budget.isFavorite ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground")}/>
                        </Button>
                        <BudgetDialog budget={budget} onSave={handleSaveBudget}>
                             <Button variant="ghost" size="icon"><Edit className="h-4 w-4"/></Button>
                        </BudgetDialog>
                         <Button variant="ghost" size="icon" onClick={() => deleteBudget(budget.id)}>
                            <Trash2 className="h-4 w-4 text-red-500"/>
                        </Button>
                    </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="mb-2">
                    <span className="font-bold text-lg">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.spent)}</span>
                    <span className="text-sm text-muted-foreground"> Spent</span>
                  </div>
                  <Progress value={budget.progress} className={budget.progress > 100 ? '[&>div]:bg-destructive' : ''} />
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.amount)} Goal
                    </span>
                    <span className={`font-medium ${budget.remaining < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.remaining)} {budget.remaining >= 0 ? 'left' : 'over'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BudgetsPage() {
    return (
        <FeatureGate>
            <BudgetsPageContent />
        </FeatureGate>
    )
}
