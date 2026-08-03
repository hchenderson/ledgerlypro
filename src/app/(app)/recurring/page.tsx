

"use client";

import { useState, useMemo } from 'react';
import { useCategories } from '@/hooks/use-categories';
import { useRecurringTransactions } from '@/hooks/use-recurring-transactions';
import { useAccounts } from '@/hooks/use-accounts';
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
import { useEnvelopes } from '@/hooks/use-envelopes';
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
} from '@/components/ui/alert-dialog';

const recurringFormSchema = z.object({
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Please select a category.'),
  categoryId: z.string().min(1, 'Please select a category.'),
  accountId: z.string().min(1, 'Please select an account.'),
  envelopeId: z.string().optional(),
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
  const {
    accounts,
    activeAccounts,
    primaryAccountId,
    selectedAccountIds,
  } = useAccounts();
  const { budgetingMode } = useAuth();
  const { activeEnvelopes } = useEnvelopes();
  const selectedActiveAccountId =
    selectedAccountIds.length === 1 &&
    activeAccounts.some(
      (account) => account.id === selectedAccountIds[0],
    )
      ? selectedAccountIds[0]
      : undefined;
  const form = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: transaction ? {
      ...transaction,
      categoryId: transaction.categoryId
        ?? flattenCategoryOptions(categories).find((category) => category.name === transaction.category)?.id
        ?? '',
      startDate: new Date(transaction.startDate),
      accountId:
        transaction.accountId ??
        selectedActiveAccountId ??
        primaryAccountId ??
        '',
      envelopeId: transaction.envelopeId ?? 'none',
    } : {
      description: '',
      amount: 0,
      type: 'expense',
      category: '',
      categoryId: '',
      accountId:
        selectedActiveAccountId ?? primaryAccountId ?? '',
      envelopeId: 'none',
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
        <FormField
          control={form.control}
          name="accountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={isReadOnly}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {[
                    ...activeAccounts,
                    ...accounts.filter(
                      (account) =>
                        account.isArchived &&
                        account.id === field.value,
                    ),
                  ].map((account) => (
                    <SelectItem
                      key={account.id}
                      value={account.id}
                    >
                      {account.name}
                      {account.isArchived ? " (Archived)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
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
        {type === 'expense' && budgetingMode !== 'tracking' && activeEnvelopes.length > 0 ? (
          <FormField control={form.control} name="envelopeId" render={({ field }) => (
            <FormItem><FormLabel>Envelope (Optional)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}>
                <FormControl><SelectTrigger><SelectValue placeholder="No envelope" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="none">No envelope</SelectItem>
                  {activeEnvelopes.map((envelope) => (
                    <SelectItem key={envelope.id} value={envelope.id}>{envelope.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Future occurrences will use this envelope when they post.</p>
              <FormMessage />
            </FormItem>
          )} />
        ) : null}
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
        <DialogFooter className="gap-2">
          <DialogClose asChild><Button type="button" variant="outline" className="h-11 sm:h-10">Cancel</Button></DialogClose>
          <Button type="submit" disabled={isReadOnly} className="h-11 sm:h-10">Save</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function RecurringDialog({ transaction, onSave, children, isReadOnly }: { transaction?: RecurringTransaction, onSave: (values: RecurringFormValues, id?: string) => void, children: React.ReactNode, isReadOnly: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const { categories } = useCategories();
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
  } = useRecurringTransactions();
  const {
    allAccountsSelected,
    selectedAccountIds,
    primaryAccountId,
    getAccountName,
  } = useAccounts();
  const { getEnvelopeName } = useEnvelopes();
  const { activeYear } = useAuth();
  const systemYear = new Date().getFullYear();
  const isReadOnly = activeYear < systemYear;

  const handleSave = (values: RecurringFormValues, id?: string) => {
    if (isReadOnly) return;
    const data = {
      ...values,
      envelopeId:
        values.type === 'expense' && values.envelopeId !== 'none'
          ? values.envelopeId
          : undefined,
      startDate: values.startDate.toISOString(),
    };
    if (id) {
      updateRecurringTransaction(id, data);
    } else {
      addRecurringTransaction(data);
    }
  };

  const sortedRecurringTransactions = useMemo(() => {
    if (!recurringTransactions) return [];
    const visibleSchedules = allAccountsSelected
      ? recurringTransactions
      : recurringTransactions.filter((schedule) =>
          selectedAccountIds.includes(
            schedule.accountId ?? primaryAccountId ?? "",
          ),
        );
    return [...visibleSchedules].sort((a, b) => {
      const nextA = calculateNextOccurrence(a);
      const nextB = calculateNextOccurrence(b);
      return nextA.getTime() - nextB.getTime();
    })
  }, [
    allAccountsSelected,
    primaryAccountId,
    recurringTransactions,
    selectedAccountIds,
  ]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-headline text-2xl font-bold tracking-tight">
            <Repeat className="h-6 w-6 shrink-0" /> Recurring Transactions
          </h2>
          <p className="text-muted-foreground">
            Automate your regular income and expenses.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Button
            variant="outline"
            onClick={() => void syncRecurringTransactions().catch(() => undefined)}
            disabled={isReadOnly || recurringSync.status === 'syncing'}
            className="h-11 w-full sm:h-10 sm:w-auto"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', recurringSync.status === 'syncing' && 'animate-spin')} />
            Sync now
          </Button>
          <RecurringDialog onSave={handleSave} isReadOnly={isReadOnly}>
            <Button
              disabled={isReadOnly}
              title={isReadOnly ? "You cannot add recurring transactions in a past year." : "Add new recurring transaction"}
              className="h-11 w-full sm:h-10 sm:w-auto"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              New Recurring Transaction
            </Button>
          </RecurringDialog>
        </div>
      </div>
      {recurringSync.status !== 'idle' && (
        <div
          className={cn(
            'flex flex-col gap-2 rounded-md border px-3 py-3 text-sm sm:flex-row sm:items-center',
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
            <span className="text-muted-foreground sm:ml-auto">
              {format(recurringSync.lastSyncedAt, 'MMM d, h:mm a')}
            </span>
          )}
        </div>
      )}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y md:hidden">
            {sortedRecurringTransactions.length > 0 ? (
              sortedRecurringTransactions.map((rt) => (
                <article key={rt.id} className="p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{rt.description}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="max-w-full truncate">
                          {rt.category}
                        </Badge>
                        <Badge variant="secondary" className="max-w-full truncate">
                          {getAccountName(rt.accountId)}
                        </Badge>
                        {rt.envelopeId ? (
                          <Badge variant="outline" className="max-w-full truncate">
                            {getEnvelopeName(rt.envelopeId)} envelope
                          </Badge>
                        ) : null}
                        <span className="capitalize">{rt.frequency}</span>
                      </div>
                    </div>
                    <p
                      className={cn(
                        "max-w-[50%] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap font-semibold",
                        rt.type === "income" ? "text-emerald-600" : "text-red-500"
                      )}
                    >
                      {rt.type === "income" ? "+" : "-"}
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(rt.amount)}
                    </p>
                  </div>

                  <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Next date: </span>
                    <time dateTime={calculateNextOccurrence(rt).toISOString()}>
                      {format(calculateNextOccurrence(rt), "MMM d, yyyy")}
                    </time>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <RecurringDialog transaction={rt} onSave={handleSave} isReadOnly={isReadOnly}>
                      <Button
                        variant="outline"
                        className="h-11"
                        disabled={isReadOnly}
                        aria-label={`Edit ${rt.description}`}
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                    </RecurringDialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-11 text-destructive hover:text-destructive"
                          disabled={isReadOnly}
                          aria-label={`Delete ${rt.description}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete recurring transaction?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete {rt.description} and stop future
                            automatic entries. Existing transactions will not be changed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteRecurringTransaction(rt.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </article>
              ))
            ) : (
              <div className="flex h-24 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                No recurring transactions set up.
              </div>
            )}
          </div>

          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="hidden lg:table-cell">Account</TableHead>
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
                    <TableCell className="hidden max-w-44 truncate lg:table-cell">
                      {getAccountName(rt.accountId)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell capitalize">{rt.frequency}</TableCell>
                    <TableCell>{format(calculateNextOccurrence(rt), "MMM d, yyyy")}</TableCell>
                    <TableCell className={cn("text-right", rt.type === 'income' ? 'text-emerald-500' : 'text-red-500')}>
                      {rt.type === 'income' ? '+' : '-'}{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(rt.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <RecurringDialog transaction={rt} onSave={handleSave} isReadOnly={isReadOnly}>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isReadOnly}
                          aria-label={`Edit ${rt.description}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </RecurringDialog>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => !isReadOnly && deleteRecurringTransaction(rt.id)}
                        disabled={isReadOnly}
                        aria-label={`Delete ${rt.description}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No recurring transactions set up.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
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
