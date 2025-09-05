
"use client";

import { useState, useMemo } from 'react';
import { useUserData } from '@/hooks/use-user-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PlusCircle, Target, Trash2, Edit, Star } from 'lucide-react';
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Budget, Category, SubCategory } from '@/types';
import { FeatureGate } from '@/components/feature-gate';
import { cn } from '@/lib/utils';


const budgetFormSchema = z.object({
  categoryId: z.string().min(1, 'Please select a category.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

function BudgetDialog({ budget, onSave, children }: { budget?: Budget, onSave: (values: BudgetFormValues, id?: string) => void, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { categories } = useUserData();
  const { toast } = useToast();

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      categoryId: budget?.categoryId || '',
      amount: budget?.amount || 0,
    }
  });

  const onSubmit = (data: BudgetFormValues) => {
    onSave(data, budget?.id);
    toast({
      title: budget ? 'Budget Updated' : 'Budget Created',
      description: `Your budget has been successfully saved.`,
    });
    setIsOpen(false);
    form.reset();
  };
  
  const expenseCategories = useMemo(() => {
    const flatten = (cats: (Category | SubCategory)[], parentName?: string): { id: string; name: string }[] => {
      let options: { id: string; name: string }[] = [];
      for (const cat of cats) {
        const name = parentName ? `${parentName} -> ${cat.name}` : cat.name;
        options.push({ id: cat.id, name });

        if (cat.subCategories && Array.isArray(cat.subCategories)) {
          options = [...options, ...flatten(cat.subCategories, name)];
        }
      }
      return options;
    };
    const expenseCats = categories.filter(c => c.type === 'expense');
    return flatten(expenseCats);
  }, [categories]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{budget ? 'Edit' : 'Create'} Budget</DialogTitle>
          <DialogDescription>
            Set a monthly spending limit for a category or sub-category.
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
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Budget Amount</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 500" {...field} />
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
  const { budgets, transactions, categories, addBudget, updateBudget, deleteBudget, toggleFavoriteBudget, loading } = useUserData();

  const handleSaveBudget = (values: BudgetFormValues, id?: string) => {
    if (id) {
        updateBudget(id, { ...values, period: 'monthly' });
    } else {
        const newBudget: Budget = {
            id: `bud_${Date.now()}`,
            ...values,
            period: 'monthly',
            isFavorite: false,
        };
        addBudget(newBudget);
    }
  };
  
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

    const getCategoryName = (id: string, cats: Category[]): string => {
        const category = findCategoryById(id, cats);
        return category ? category.name : "Unknown Category";
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
    return budgets.map(budget => {
      const category = findCategoryById(budget.categoryId, categories);
      
      const targetCategoryNames: string[] = [];
      if(category) {
          const rootCategoryForBudget = findCategoryById(budget.categoryId, categories);
          if (rootCategoryForBudget) {
            targetCategoryNames.push(...getAllSubCategoryNames(rootCategoryForBudget));
          }
      }

      const spent = transactions
        .filter(t => 
            t.type === 'expense' && 
            targetCategoryNames.some(catName => catName === t.category) &&
            new Date(t.date).getMonth() === new Date().getMonth() &&
            new Date(t.date).getFullYear() === new Date().getFullYear()
        )
        .reduce((sum, t) => sum + t.amount, 0);

      const remaining = budget.amount - spent;
      const progress = (spent / budget.amount) * 100;

      return {
        ...budget,
        categoryName: getCategoryName(budget.categoryId, categories),
        spent,
        remaining,
        progress,
      };
    });
  }, [budgets, transactions, categories]);
  
  if (loading) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight font-headline flex items-center gap-2">
            <Target/> Monthly Budgets
          </h2>
          <p className="text-muted-foreground">
            Track your spending against monthly goals. Use the star to feature a budget on your dashboard.
          </p>
        </div>
        <BudgetDialog onSave={handleSaveBudget}>
             <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Budget
            </Button>
        </BudgetDialog>
      </div>

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
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.amount)} / month
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
                  <Progress value={budget.progress} className={budget.progress > 100 ? '[&>div]:bg-destructive' : ''} />
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.spent)} spent
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

    