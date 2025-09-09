
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useUserData } from '@/hooks/use-user-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PlusCircle, Target, Trash2, Edit, Star, ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
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
import { useForm, useWatch } from 'react-hook-form';
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
import { addMonths, subMonths, format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';


const budgetFormSchema = z.object({
  name: z.string().min(2, 'Budget name must be at least 2 characters.'),
  categoryId: z.string().min(1, 'Please select a category.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  period: z.enum(['monthly', 'fixed']),
  startDate: z.date(),
  endDate: z.date().optional(),
}).refine(data => {
    if (data.period === 'fixed' && data.endDate) {
        return data.endDate > data.startDate;
    }
    return true;
}, {
    message: "End date must be after the start date.",
    path: ["endDate"],
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

function BudgetDialog({ budget, onSave, children }: { budget?: Budget, onSave: (values: BudgetFormValues, id?: string) => void, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { categories, budgets } = useUserData();
  const { toast } = useToast();

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: budget ? {
        ...budget,
        startDate: new Date(budget.startDate),
        endDate: budget.endDate ? new Date(budget.endDate) : undefined,
    } : {
      name: '',
      categoryId: '',
      amount: 0,
      period: 'monthly',
      startDate: new Date(),
    }
  });
  
  useEffect(() => {
    if (isOpen) {
        form.reset(budget ? {
            ...budget,
            startDate: new Date(budget.startDate),
            endDate: budget.endDate ? new Date(budget.endDate) : undefined,
        } : {
          name: '',
          categoryId: '',
          amount: 0,
          period: 'monthly',
          startDate: new Date(),
          endDate: undefined,
        });
    }
  }, [isOpen, budget, form]);

  const onSubmit = (data: BudgetFormValues) => {
    onSave(data, budget?.id);
    toast({
      title: budget ? 'Budget Updated' : 'Budget Created',
      description: `Your budget for "${data.name}" has been successfully saved.`,
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
      return flatten(categories.filter(c => c.type === 'expense'));
  }, [categories, budgets, budget]);
  
  const period = useWatch({ control: form.control, name: 'period' });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{budget ? 'Edit' : 'Create'} Budget</DialogTitle>
          <DialogDescription>
            Set a monthly spending limit or a fixed long-term budget for a category.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Budget Name</FormLabel><FormControl><Input placeholder="e.g., Vacation Fund" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
            <FormField control={form.control} name="period" render={({ field }) => (
                <FormItem className="space-y-3"><FormLabel>Period</FormLabel>
                <FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="monthly" /></FormControl><FormLabel className="font-normal">Monthly</FormLabel></FormItem>
                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="fixed" /></FormControl><FormLabel className="font-normal">Fixed</FormLabel></FormItem>
                </RadioGroup></FormControl><FormMessage /></FormItem>
            )}/>
            
            {period === 'fixed' ? (
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Start Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="endDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>End Date (Optional)</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">This budget will apply to the current month going forward.</p>
            )}

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
    const budgetData = {
        ...values,
        startDate: values.startDate.toISOString(),
        endDate: values.endDate ? values.endDate.toISOString() : undefined
    }
    if (id) {
        updateBudget(id, budgetData);
    } else {
        addBudget({
            ...budgetData,
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
            Track your spending against monthly or long-term goals.
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
                <CardTitle>Viewing Monthly Budgets For</CardTitle>
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
                        <CardTitle>{budget.name}</CardTitle>
                        <CardDescription>
                             {budget.period === 'monthly'
                                ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.amount)} / month`
                                : `${format(new Date(budget.startDate), 'MMM yyyy')} - ${budget.endDate ? format(new Date(budget.endDate), 'MMM yyyy') : 'Present'}`
                            }
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
                    <span className="font-bold text-lg">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(budget.amount)}</span>
                    <span className="text-sm text-muted-foreground"> Goal</span>
                  </div>
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
