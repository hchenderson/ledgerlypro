

"use client";

import { useState, useMemo } from 'react';
import { useUserData } from '@/hooks/use-user-data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Repeat, Trash2, Edit, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
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
import type { RecurringTransaction, Category, SubCategory } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, addDays, addWeeks, addMonths, addYears, parseISO, isBefore, startOfToday } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FeatureGate } from '@/components/feature-gate';
import { useAuth } from '@/hooks/use-auth';

const recurringFormSchema = z.object({
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Please select a category.'),
  categoryId: z.string().min(1, 'Please select a category.'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  startDate: z.date(),
});

type RecurringFormValues = z.infer<typeof recurringFormSchema>;

function flattenCategoryOptions(
  categories: (Category | SubCategory)[]
): Array<{ id: string; name: string }> {
  return categories.flatMap((category) => [
    { id: category.id, name: category.name },
    ...flattenCategoryOptions(category.subCategories ?? []),
  ]);
}

function RecurringForm({ transaction, onSave, categories, closeDialog, isReadOnly }: { transaction?: RecurringTransaction, onSave: (values: RecurringFormValues, id?: string) => void, categories: Category[], closeDialog: () => void, isReadOnly: boolean }) {
  const form = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: transaction ? {
      ...transaction,
      categoryId: transaction.categoryId
        ?? flattenCategoryOptions(categories).find((category) => category.name === transaction.category)?.id
        ?? '',
      startDate: new Date(transaction.startDate),
    } : {
      description: '',
      amount: 0,
      type: 'expense',
      category: '',
      categoryId: '',
      frequency: 'monthly',
      startDate: new Date(),
    }
  });

  const onSubmit = (data: RecurringFormValues) => {
    onSave(data, transaction?.id);
    closeDialog();
  };

  const type = form.watch('type');
  
  const availableCategories = useMemo(() => {
    return flattenCategoryOptions(categories.filter(c => c.type === type));
  }, [categories, type]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Input placeholder="e.g., Netflix Subscription" {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" placeholder="15.99" {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="type" render={({ field }) => (
          <FormItem className="space-y-3"><FormLabel>Type</FormLabel><FormControl>
            <RadioGroup
              onValueChange={(value) => {
                field.onChange(value);
                form.setValue('category', '');
                form.setValue('categoryId', '');
              }}
              defaultValue={field.value}
              className="flex space-x-4"
              disabled={isReadOnly}
            >
              <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="income" /></FormControl><FormLabel className="font-normal">Income</FormLabel></FormItem>
              <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="expense" /></FormControl><FormLabel className="font-normal">Expense</FormLabel></FormItem>
            </RadioGroup>
          </FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="categoryId" render={({ field }) => (
          <FormItem><FormLabel>Category</FormLabel>
            <Select
              onValueChange={(categoryId) => {
                field.onChange(categoryId);
                form.setValue(
                  'category',
                  availableCategories.find((category) => category.id === categoryId)?.name ?? ''
                );
              }}
              defaultValue={field.value}
              disabled={isReadOnly}
            ><FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
              <SelectContent>{availableCategories.map(category => (<SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>))}</SelectContent>
            </Select><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="frequency" render={({ field }) => (
          <FormItem><FormLabel>Frequency</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger></FormControl>
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
                      disabled={isReadOnly}
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
                    disabled={isReadOnly}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          <Button type="submit" disabled={isReadOnly}>Save</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function RecurringDialog({ transaction, onSave, children, isReadOnly }: { transaction?: RecurringTransaction, onSave: (values: RecurringFormValues, id?: string) => void, children: React.ReactNode, isReadOnly: boolean }) {
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
          isReadOnly={isReadOnly}
        />
      </DialogContent>
    </Dialog>
  );
}

function calculateNextOccurrence(rt: RecurringTransaction): Date {
  const today = startOfToday();
  const startDate = parseISO(rt.startDate);

  let nextDate = startDate;
  
  if (rt.lastAddedDate) {
    nextDate = parseISO(rt.lastAddedDate);
    switch (rt.frequency) {
        case 'daily':   nextDate = addDays(nextDate, 1); break;
        case 'weekly':  nextDate = addWeeks(nextDate, 1); break;
        case 'monthly': nextDate = addMonths(nextDate, 1); break;
        case 'yearly':  nextDate = addYears(nextDate, 1); break;
    }
  }

  while (isBefore(nextDate, today)) {
    switch (rt.frequency) {
      case 'daily':   nextDate = addDays(nextDate, 1); break;
      case 'weekly':  nextDate = addWeeks(nextDate, 1); break;
      case 'monthly': nextDate = addMonths(nextDate, 1); break;
      case 'yearly':  nextDate = addYears(nextDate, 1); break;
    }
  }

  return nextDate;
}

function RecurringPageContent() {
  const {
    recurringTransactions,
    addRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    loading,
    recurringSync,
    syncRecurringTransactions,
  } = useUserData();
  const { activeYear } = useAuth();
  const systemYear = new Date().getFullYear();
  const isReadOnly = activeYear < systemYear;

  const handleSave = (values: RecurringFormValues, id?: string) => {
    if (isReadOnly) return;
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight font-headline flex items-center gap-2">
            <Repeat /> Recurring Transactions
          </h2>
          <p className="text-muted-foreground">
            Automate your regular income and expenses.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void syncRecurringTransactions().catch(() => undefined)}
            disabled={isReadOnly || recurringSync.status === 'syncing'}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', recurringSync.status === 'syncing' && 'animate-spin')} />
            Sync now
          </Button>
          <RecurringDialog onSave={handleSave} isReadOnly={isReadOnly}>
            <Button disabled={isReadOnly} title={isReadOnly ? "You cannot add recurring transactions in a past year." : "Add new recurring transaction"}>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Recurring Transaction
            </Button>
          </RecurringDialog>
        </div>
      </div>
      {recurringSync.status !== 'idle' && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
            recurringSync.status === 'error' && 'border-destructive/40 text-destructive'
          )}
          role={recurringSync.status === 'error' ? 'alert' : 'status'}
        >
          {recurringSync.status === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : recurringSync.status === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <RefreshCw className="h-4 w-4 animate-spin" />
          )}
          <span>{recurringSync.message}</span>
          {recurringSync.lastSyncedAt && (
            <span className="ml-auto text-muted-foreground">
              {format(recurringSync.lastSyncedAt, 'MMM d, h:mm a')}
            </span>
          )}
        </div>
      )}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell">Frequency</TableHead>
                <TableHead>Next Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRecurringTransactions.length > 0 ? (
                sortedRecurringTransactions.map(rt => (
                  <TableRow key={rt.id}>
                    <TableCell className="font-medium max-w-[120px] truncate sm:max-w-xs">{rt.description}</TableCell>
                    <TableCell className="hidden md:table-cell"><Badge variant="outline">{rt.category}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell capitalize">{rt.frequency}</TableCell>
                    <TableCell>{format(calculateNextOccurrence(rt), "MMM d, yyyy")}</TableCell>
                    <TableCell className={cn("text-right", rt.type === 'income' ? 'text-emerald-500' : 'text-red-500')}>
                      {rt.type === 'income' ? '+' : '-'}{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(rt.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <RecurringDialog transaction={rt} onSave={handleSave} isReadOnly={isReadOnly}>
                        <Button variant="ghost" size="icon" disabled={isReadOnly}><Edit className="h-4 w-4" /></Button>
                      </RecurringDialog>
                      <Button variant="ghost" size="icon" onClick={() => !isReadOnly && deleteRecurringTransaction(rt.id)} disabled={isReadOnly}>
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
