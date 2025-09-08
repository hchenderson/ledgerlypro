
"use client";

import { useState, useMemo } from 'react';
import { useUserData } from '@/hooks/use-user-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Repeat, Trash2, Edit } from 'lucide-react';
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
import type { RecurringTransaction, Category } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, addDays, addWeeks, addMonths, addYears, parseISO, isBefore, startOfToday, isToday } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FeatureGate } from '@/components/feature-gate';

const recurringFormSchema = z.object({
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Please select a category.'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  startDate: z.date(),
});

type RecurringFormValues = z.infer<typeof recurringFormSchema>;

function RecurringForm({ transaction, onSave, categories, closeDialog }: { transaction?: RecurringTransaction, onSave: (values: RecurringFormValues, id?: string) => void, categories: Category[], closeDialog: () => void }) {
  const form = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: {
      description: transaction?.description || '',
      amount: transaction?.amount || 0,
      type: transaction?.type || 'expense',
      category: transaction?.category || '',
      frequency: transaction?.frequency || 'monthly',
      startDate: transaction ? new Date(transaction.startDate) : new Date(),
    }
  });

  const onSubmit = (data: RecurringFormValues) => {
    onSave(data, transaction?.id);
    closeDialog();
  };

  const type = form.watch('type');
  const availableCategories = useMemo(() => {
    const flattenCategories = (cats: Category[]): string[] => {
        return cats.flatMap(c => [c.name, ...(c.subCategories ? flattenCategories(c.subCategories as any) : [])]);
    };
    return flattenCategories(categories.filter(c => c.type === type));
  }, [categories, type]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Input placeholder="e.g., Netflix Subscription" {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" placeholder="15.99" {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="type" render={({ field }) => (
          <FormItem className="space-y-3"><FormLabel>Type</FormLabel><FormControl>
            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
              <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="income" /></FormControl><FormLabel className="font-normal">Income</FormLabel></FormItem>
              <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="expense" /></FormControl><FormLabel className="font-normal">Expense</FormLabel></FormItem>
            </RadioGroup>
          </FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="category" render={({ field }) => (
          <FormItem><FormLabel>Category</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
              <SelectContent>{availableCategories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent>
            </Select><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="frequency" render={({ field }) => (
          <FormItem><FormLabel>Frequency</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select><FormMessage /></FormItem>
        )} />
        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Start Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
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
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          <Button type="submit">Save</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function RecurringDialog({ transaction, onSave, children }: { transaction?: RecurringTransaction, onSave: (values: RecurringFormValues, id?: string) => void, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { categories } = useUserData();
  const { toast } = useToast();

  const handleSave = (values: RecurringFormValues, id?: string) => {
    onSave(values, id);
    toast({
      title: transaction ? 'Recurring Transaction Updated' : 'Recurring Transaction Created',
      description: `Your recurring transaction has been successfully saved.`,
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Edit' : 'Create'} Recurring Transaction</DialogTitle>
          <DialogDescription>
            Set up a transaction that repeats on a schedule.
          </DialogDescription>
        </DialogHeader>
        <RecurringForm
          transaction={transaction}
          onSave={handleSave}
          categories={categories}
          closeDialog={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function calculateNextOccurrence(rt: RecurringTransaction): Date {
  const today = startOfToday();
  let nextDate = parseISO(rt.startDate);

  // If start date is in the future, that's the next date.
  if (isBefore(today, nextDate)) {
    return nextDate;
  }

  // Use last added date if available and it's after the start date
  const baseDate = rt.lastAddedDate && isBefore(nextDate, parseISO(rt.lastAddedDate))
    ? parseISO(rt.lastAddedDate)
    : nextDate;

  nextDate = baseDate;

  while (isBefore(nextDate, today)) {
    switch (rt.frequency) {
      case 'daily': nextDate = addDays(nextDate, 1); break;
      case 'weekly': nextDate = addWeeks(nextDate, 1); break;
      case 'monthly': nextDate = addMonths(nextDate, 1); break;
      case 'yearly': nextDate = addYears(nextDate, 1); break;
    }
  }
  
   // If the calculated next date is still the same as the base date (and it's in the past), advance it once.
  if (isBefore(nextDate, today) || isToday(nextDate)) {
     if(rt.lastAddedDate || isBefore(parseISO(rt.startDate), today)){
        switch(rt.frequency) {
            case 'daily': nextDate = addDays(nextDate, 1); break;
            case 'weekly': nextDate = addWeeks(nextDate, 1); break;
            case 'monthly': nextDate = addMonths(nextDate, 1); break;
            case 'yearly': nextDate = addYears(nextDate, 1); break;
        }
     }
  }


  return nextDate;
}

function RecurringPageContent() {
  const { recurringTransactions, addRecurringTransaction, updateRecurringTransaction, deleteRecurringTransaction, loading } = useUserData();

  const handleSave = (values: RecurringFormValues, id?: string) => {
    const data = { ...values, startDate: values.startDate.toISOString() };
    if (id) {
      updateRecurringTransaction(id, data);
    } else {
      addRecurringTransaction(data);
    }
  };

  const sortedRecurringTransactions = useMemo(() => {
    if (!recurringTransactions) return [];
    return [...recurringTransactions].sort((a, b) => {
      const nextA = calculateNextOccurrence(a);
      const nextB = calculateNextOccurrence(b);
      return nextA.getTime() - nextB.getTime();
    })
  }, [recurringTransactions]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight font-headline flex items-center gap-2">
            <Repeat /> Recurring Transactions
          </h2>
          <p className="text-muted-foreground">
            Automate your regular income and expenses.
          </p>
        </div>
        <RecurringDialog onSave={handleSave}>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Recurring Transaction
          </Button>
        </RecurringDialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next Date</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRecurringTransactions.length > 0 ? (
                sortedRecurringTransactions.map(rt => (
                  <TableRow key={rt.id}>
                    <TableCell className="font-medium">{rt.description}</TableCell>
                    <TableCell className={rt.type === 'income' ? 'text-emerald-500' : 'text-red-500'}>
                      {rt.type === 'income' ? '+' : '-'}{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(rt.amount)}
                    </TableCell>
                    <TableCell><Badge variant="outline">{rt.category}</Badge></TableCell>
                    <TableCell className="capitalize">{rt.frequency}</TableCell>
                    <TableCell>{format(calculateNextOccurrence(rt), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <RecurringDialog transaction={rt} onSave={handleSave}>
                        <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                      </RecurringDialog>
                      <Button variant="ghost" size="icon" onClick={() => deleteRecurringTransaction(rt.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No recurring transactions set up.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RecurringPage() {
  return (
    <FeatureGate>
      <RecurringPageContent />
    </FeatureGate>
  );
}
