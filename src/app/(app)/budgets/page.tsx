
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useBudgets } from '@/hooks/use-budgets';
import { useCategories } from '@/hooks/use-categories';
import { useTransactionsForYears } from '@/hooks/use-transactions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PlusCircle, Target, Trash2, Edit, Star, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
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
import { format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/hooks/use-auth';
import { useComparison } from '@/hooks/use-comparison';

const budgetFormSchema = z.object({
  categoryId: z.string().min(1, 'Please select a category.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  period: z.enum(['monthly', 'yearly']),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

function ComparisonCard({ deltas, comparisonPeriod }: { deltas: any, comparisonPeriod: string }) {
    if (!deltas) return null;

    const formatDelta = (value: number, isCurrency = true) => {
        const sign = value > 0 ? '+' : '−';
        const formattedValue = isCurrency ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(value)) : Math.abs(value);
        return `${sign}${formattedValue}`;
    };

    return (
        <Card className="bg-muted/50 mt-4">
            <CardHeader className="p-4">
                <CardDescription>Comparison vs. {comparisonPeriod}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-sm">
                 <div className="flex justify-between">
                    <span className="flex items-center gap-1">
                        {deltas.spent > 0 ? <ArrowUp className="h-4 w-4 text-red-500" /> : <ArrowDown className="h-4 w-4 text-emerald-500" />}
                        Spent
                    </span>
                    <span className={cn(deltas.spent > 0 ? "text-red-500" : "text-emerald-500", "font-medium")}>
                        {formatDelta(deltas.spent)}
                    </span>
                </div>
                <div className="flex justify-between mt-2">
                    <span className="flex items-center gap-1">
                         {deltas.remaining < 0 ? <ArrowUp className="h-4 w-4 text-red-500" /> : <ArrowDown className="h-4 w-4 text-emerald-500" />}
                        Remaining
                    </span>
                     <span className={cn(deltas.remaining < 0 ? "text-red-500" : "text-emerald-500", "font-medium")}>
                        {formatDelta(deltas.remaining)}
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}

function BudgetDialog({ budget, onSave, children, isReadOnly }: { budget?: Budget, onSave: (values: BudgetFormValues, id?: string) => void, children: React.ReactNode, isReadOnly: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const { categories } = useCategories();
  const { budgets } = useBudgets();
  const { activeYear } = useAuth();
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
    if (isReadOnly) return;
    onSave(data, budget?.id);
    const categoryName = categories.find(c => c.id === data.categoryId)?.name || 'the';
    toast({
      title: budget ? 'Budget Updated' : 'Budget Created',
      description: `Your budget for the "${categoryName}" category has been successfully saved for ${activeYear}.`,
    });
    setIsOpen(false);
  };
  
  const budgetsForActiveYear = useMemo(() => budgets.filter(b => b.year === activeYear), [budgets, activeYear]);

  const expenseCategories = useMemo(() => {
      const budgetedCategoryIds = new Set(budgetsForActiveYear.filter(b => b.id !== budget?.id).map(b => b.categoryId));
      
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
      
      const getExpenseCategories = (cats: Category[]) => {
          const expenseCats: (Category | SubCategory)[] = [];
          cats.forEach(c => {
              if (c.type === 'expense') {
                  expenseCats.push(c);
              }
          });
          return expenseCats;
      }
      
      return flatten(getExpenseCategories(categories));
  }, [categories, budgetsForActiveYear, budget]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{budget ? 'Edit' : 'Create'} Budget for {activeYear}</DialogTitle>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!budget || isReadOnly}>
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
            <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Budget Amount</FormLabel><FormControl><Input type="number" placeholder="e.g., 500" {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)} />
            
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
                      disabled={!!budget || isReadOnly}
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

            <DialogFooter className="gap-2">
              <DialogClose asChild><Button type="button" variant="outline" className="h-11 sm:h-10">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isReadOnly} className="h-11 sm:h-10">Save Budget</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


function BudgetsPageContent() {
  const {
    budgets,
    addBudget,
    updateBudget,
    deleteBudget,
    toggleFavoriteBudget,
    loading: budgetsLoading,
    getBudgetDetails,
  } = useBudgets();
  const {
    categories,
    loading: categoriesLoading,
  } = useCategories();
  const { activeYear } = useAuth();
  const { isComparing, comparisonYear } = useComparison();
  const {
    transactions: allTransactions,
    loading: transactionsLoading,
  } = useTransactionsForYears(
    comparisonYear ? [activeYear, comparisonYear] : [activeYear],
  );
  const loading =
    budgetsLoading || categoriesLoading || transactionsLoading;
  
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const systemYear = new Date().getFullYear();
  const isReadOnly = activeYear < systemYear || isComparing;

  const selectedDate = useMemo(() => {
    return new Date(activeYear, currentMonth, 1);
  }, [activeYear, currentMonth]);
  
  const activeYearBudgets = useMemo(() => budgets.filter(b => b.year === activeYear), [budgets, activeYear]);
  const comparisonYearBudgets = useMemo(() => comparisonYear ? budgets.filter(b => b.year === comparisonYear) : [], [budgets, comparisonYear]);

  const budgetDetails = useMemo(() => {
    if (!activeYearBudgets) return [];
    return getBudgetDetails({
      activeBudgets: activeYearBudgets,
      comparisonBudgets: comparisonYearBudgets,
      transactions: allTransactions,
      categories: categories,
      forDate: selectedDate,
      comparisonYear: comparisonYear,
    });
  }, [getBudgetDetails, activeYearBudgets, comparisonYearBudgets, allTransactions, categories, selectedDate, comparisonYear]);

  const [order, setOrder] = useState<string[]>([]);
  const [draggedItem, setDraggedItem] = useState<{item: any, index: number} | null>(null);

  useEffect(() => {
    if (budgetDetails) {
        setOrder(budgetDetails.map(b => b.id));
    }
  }, [budgetDetails]);

  const orderedBudgets = useMemo(() => {
    if (!order.length || !budgetDetails) return budgetDetails;
    const budgetMap = new Map(budgetDetails.map(b => [b.id, b]));
    return order.map(id => budgetMap.get(id)).filter(b => b !== undefined) as typeof budgetDetails;
  }, [order, budgetDetails]);

  const handleSaveBudget = (values: BudgetFormValues, id?: string) => {
    if (isReadOnly) return;
    if (id) {
        updateBudget(id, values);
    } else {
        addBudget({
            ...values,
            year: activeYear,
            isFavorite: false,
        });
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => prev === 0 ? 11 : prev - 1);
  }
  
  const handleNextMonth = () => {
    setCurrentMonth(prev => prev === 11 ? 0 : prev + 1);
  }

  const moveBudget = (index: number, direction: -1 | 1) => {
    if (isReadOnly) return;

    const targetIndex = index + direction;
    if (!orderedBudgets || targetIndex < 0 || targetIndex >= orderedBudgets.length) return;

    setOrder((currentOrder) => {
      const nextOrder = currentOrder.length
        ? [...currentOrder]
        : orderedBudgets.map((budget) => budget.id);
      [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];
      return nextOrder;
    });
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: any, index: number) => {
    if (isReadOnly) return;
    setDraggedItem({ item, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (isReadOnly || !draggedItem) return;
    
    if (!orderedBudgets) return;
    const draggedOverId = orderedBudgets[index].id;
    if (draggedItem.item.id === draggedOverId) return;

    const items = order.filter(id => id !== draggedItem.item.id);
    items.splice(index, 0, draggedItem.item.id);
    setOrder(items);
  };

  const handleDragEnd = () => {
    if (isReadOnly) return;
    setDraggedItem(null);
  };
  
  if (loading) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-headline text-2xl font-bold tracking-tight">
            <Target className="h-6 w-6 shrink-0"/> Budgets
          </h2>
          <p className="text-muted-foreground">
            Track your spending against your goals for {activeYear}. Reorder cards with the
            arrow controls on mobile or drag and drop on larger screens.
          </p>
        </div>
        <BudgetDialog onSave={handleSaveBudget} isReadOnly={isReadOnly}>
             <Button
                disabled={isReadOnly}
                title={isReadOnly ? "You cannot add a budget to a past year." : "Create new budget"}
                className="h-11 w-full sm:h-10 sm:w-auto"
             >
                <PlusCircle className="mr-2 h-4 w-4" />
                New Budget
            </Button>
        </BudgetDialog>
      </div>

       <Card>
            <CardHeader className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-center sm:text-left">Viewing Budgets For</CardTitle>
                <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-11 w-11"
                      onClick={handlePrevMonth}
                      aria-label="View previous month"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-0 text-center text-lg font-semibold">{format(selectedDate, "MMMM yyyy")}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-11 w-11"
                      onClick={handleNextMonth}
                      aria-label="View next month"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
       </Card>

      {!orderedBudgets || orderedBudgets.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
             <CardHeader className="text-center">
                 <Target className="mx-auto h-12 w-12 text-muted-foreground" />
                <CardTitle className="mt-4">No Budgets For {activeYear}</CardTitle>
                <CardDescription>Get started by creating your first budget for this year.</CardDescription>
            </CardHeader>
            <CardContent>
                <BudgetDialog onSave={handleSaveBudget} isReadOnly={isReadOnly}>
                    <Button disabled={isReadOnly} title={isReadOnly ? "You cannot add a budget to a past year." : "Create a budget"}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create a Budget
                    </Button>
                </BudgetDialog>
            </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orderedBudgets.map((budget, index) => (
            <div
                key={budget.id}
                draggable={!isReadOnly}
                onDragStart={(e) => handleDragStart(e, budget, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(isReadOnly ? "cursor-default" : "cursor-move", draggedItem?.item.id === budget.id && "opacity-50")}
            >
                <Card className="min-w-0 overflow-hidden">
                <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <CardTitle className="break-words">{budget.categoryName}</CardTitle>
                            <CardDescription>
                                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.amount)} / {budget.period === 'yearly' ? 'year' : 'month'}
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 md:h-10 md:w-10"
                              onClick={() => !isReadOnly && toggleFavoriteBudget(budget.id)}
                              disabled={isReadOnly}
                              aria-label={budget.isFavorite ? `Remove ${budget.categoryName} from favorites` : `Favorite ${budget.categoryName}`}
                            >
                                <Star className={cn("h-4 w-4", budget.isFavorite ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground")}/>
                            </Button>
                            <BudgetDialog budget={budget} onSave={handleSaveBudget} isReadOnly={isReadOnly}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11 md:h-10 md:w-10"
                                  disabled={isReadOnly}
                                  aria-label={`Edit ${budget.categoryName} budget`}
                                >
                                  <Edit className="h-4 w-4"/>
                                </Button>
                            </BudgetDialog>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 md:h-10 md:w-10"
                              onClick={() => !isReadOnly && deleteBudget(budget.id)}
                              disabled={isReadOnly}
                              aria-label={`Delete ${budget.categoryName} budget`}
                            >
                                <Trash2 className="h-4 w-4 text-red-500"/>
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:hidden">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={() => moveBudget(index, -1)}
                        disabled={isReadOnly || index === 0}
                        aria-label={`Move ${budget.categoryName} budget up`}
                      >
                        <ArrowUp className="h-4 w-4" />
                        Move up
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={() => moveBudget(index, 1)}
                        disabled={isReadOnly || index === orderedBudgets.length - 1}
                        aria-label={`Move ${budget.categoryName} budget down`}
                      >
                        <ArrowDown className="h-4 w-4" />
                        Move down
                      </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                    <div className="mb-2">
                        <span className="font-bold text-lg">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.spent)}</span>
                        <span className="text-sm text-muted-foreground"> Spent</span>
                    </div>
                    <Progress value={budget.progress} className={budget.progress > 100 ? '[&>div]:bg-destructive' : ''} />
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                        <span className="font-medium">
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.amount)} Goal
                        </span>
                        <span className={`font-medium ${budget.remaining < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.remaining)} {budget.remaining >= 0 ? 'left' : 'over'}
                        </span>
                    </div>
                    </div>
                    {isComparing && budget.deltas && (
                         <ComparisonCard
                            deltas={budget.deltas}
                            comparisonPeriod={budget.period === 'yearly' ? 'Year' : format(selectedDate, 'MMMM')}
                        />
                    )}
                </CardContent>
                </Card>
            </div>
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
