
"use client"

import { useState, useEffect, useMemo } from "react"
import { z } from "zod"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format, isValid, parse } from "date-fns"
import { Calendar as CalendarIcon, PlusCircle, Split, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import type { Transaction, Category, SubCategory, TransactionAllocation } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { useCategories } from "@/hooks/use-categories"
import { useAccounts } from "@/hooks/use-accounts"
import { useAuth } from "@/hooks/use-auth"
import { useEnvelopes } from "@/hooks/use-envelopes"
import { useSplitTemplates } from "@/hooks/use-split-templates"
import {
  allocationDifference,
  allocationsAreComplete,
} from "@/lib/transaction-allocations"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const formSchema = z.object({
  type: z.enum(["income", "expense"], {
    required_error: "Please select a transaction type.",
  }),
  date: z.date({
    required_error: "A date is required.",
  }),
  description: z.string().min(2, {
    message: "Description must be at least 2 characters.",
  }),
  amount: z.coerce.number().positive({
    message: "Amount must be a positive number.",
  }),
  categoryId: z.string().optional(),
  accountId: z.string().min(1, {
    message: "Please select an account.",
  }),
  envelopeId: z.string().nullable().optional(),
  category: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>
export type SubmittedTransactionValues = Omit<FormValues, 'category'> & {
  category: string;
  allocations?: TransactionAllocation[];
  allocationStatus?: "complete" | "incomplete";
};

type AllocationDraft = {
  id: string;
  categoryId: string;
  amount: string;
};

const createAllocationId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `allocation-${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface NewTransactionSheetProps {
    isOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
    transaction?: Partial<Omit<Transaction, 'id'>> & { id: string } | null;
    onTransactionCreated?: (values: SubmittedTransactionValues) => void | Promise<void>;
    onTransactionUpdated?: (id: string, values: SubmittedTransactionValues) => void | Promise<void>;
    children?: React.ReactNode;
    categories: Category[];
    historicalEditYear?: number;
}

const AddCategoryDialog = ({ 
    type, 
    categories,
    onCategoryAdded
}: { 
    type: 'income' | 'expense', 
    categories: Category[],
    onCategoryAdded: (newCategoryName: string, newCategoryId: string) => void
}) => {
    const [name, setName] = useState('');
    const [parent, setParent] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const { addCategory, addSubCategory } = useCategories();

    const mainCategories = categories.filter(c => c.type === type);
    
    const handleSubmit = async () => {
        if (!name) return;
        
        let newId: string;
        if(parent) {
            const parentId = parent.split(':')[0];
            const parentPath = parent.split(':').slice(1);
            const newSubCategory: Omit<SubCategory, 'id'> = { name, icon: 'Sparkles' };
            const addedSubCategory = await addSubCategory(parentId, newSubCategory, parentPath);
            newId = addedSubCategory.id;
        } else {
            const newCategory: Omit<Category, 'id'> = { name, type, icon: 'Sparkles', subCategories: [] };
            const addedCategory = await addCategory(newCategory);
            newId = addedCategory.id;
        }

        onCategoryAdded(name, newId);
        setIsOpen(false);
        setName('');
        setParent('');
    }
    
     const flattenCategoriesForSelect = (categories: Category[] | SubCategory[], path: string[] = []) => {
        let options: { label: string; value: string; }[] = [];
        categories.forEach(cat => {
            const currentPath = [...path, cat.id];
            options.push({ label: cat.name, value: currentPath.join(':') });
            if (cat.subCategories) {
                options = [...options, ...flattenCategoriesForSelect(cat.subCategories, currentPath)];
            }
        });
        return options;
    };
    
    const availableParents = flattenCategoriesForSelect(mainCategories);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="ghost" className="w-full justify-center mt-2 text-sm">
                    <PlusCircle className="mr-2 h-4 w-4"/>
                    Add New Category
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add a New Category</DialogTitle>
                    <DialogDescription>Create a new category for your transaction. Select a parent to make it a sub-category.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="category-name">New Category Name</Label>
                        <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Coffee" />
                    </div>
                    <div className="space-y-2">
                        <Label>Parent Category (Optional)</Label>
                        <Select onValueChange={setParent} value={parent}>
                            <SelectTrigger>
                                <SelectValue placeholder={`Select a parent ${type} category`} />
                            </SelectTrigger>
                            <SelectContent>
                                {availableParents.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                    <Button onClick={handleSubmit} type="button">Add Category</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


export function NewTransactionSheet({ 
    isOpen,
    onOpenChange,
    transaction,
    onTransactionCreated,
    onTransactionUpdated,
    children,
    categories,
    historicalEditYear,
}: NewTransactionSheetProps) {
  const { toast } = useToast()
  const {
    accounts,
    activeAccounts,
    primaryAccountId,
    selectedAccountIds,
  } = useAccounts()
  const { budgetingMode } = useAuth()
  const { activeEnvelopes, suggestEnvelope } = useEnvelopes()
  const { templates, addTemplate, deleteTemplate } = useSplitTemplates()
  const selectedActiveAccountId =
    selectedAccountIds.length === 1 &&
    activeAccounts.some(
      (account) => account.id === selectedAccountIds[0],
    )
      ? selectedAccountIds[0]
      : undefined;
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  })

  const isEditing = !!transaction?.id;
  const [isSplit, setIsSplit] = useState(false);
  const [allocations, setAllocations] = useState<AllocationDraft[]>([]);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [pendingHistoricalUpdate, setPendingHistoricalUpdate] =
    useState<SubmittedTransactionValues | null>(null);
  const [isSavingHistoricalUpdate, setIsSavingHistoricalUpdate] =
    useState(false);

  // State for the text input for the date
  const [dateInput, setDateInput] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (transaction) {
        const transactionDate = transaction.date ? new Date(transaction.date) : new Date();
        form.reset({
          ...transaction,
          type:
            transaction.type === "transfer"
              ? "expense"
              : transaction.type,
          date: transactionDate,
          amount: transaction.amount || ('' as any),
          categoryId: transaction.categoryId || undefined,
          accountId:
            transaction.accountId ??
            selectedActiveAccountId ??
            primaryAccountId ??
            undefined,
          envelopeId: transaction.envelopeId ?? "none",
        });
        setDateInput(format(transactionDate, "MM/dd/yyyy"));
        const existingAllocations = transaction.allocations ?? [];
        setIsSplit(existingAllocations.length > 0);
        setAllocations(
          existingAllocations.map((allocation) => ({
            id: allocation.id,
            categoryId: allocation.categoryId ?? "",
            amount: allocation.amount.toFixed(2),
          })),
        );
      } else {
        const today = new Date();
        form.reset({
          type: 'expense',
          description: '',
          amount: '' as any,
          categoryId: undefined,
          accountId:
            selectedActiveAccountId ??
            primaryAccountId ??
            undefined,
          envelopeId: "none",
          date: today,
        });
        setDateInput(format(today, "MM/dd/yyyy"));
        setIsSplit(false);
        setAllocations([]);
      }
      setSplitError(null);
      setTemplateName("");
    }
  }, [
    form,
    isOpen,
    primaryAccountId,
    selectedActiveAccountId,
    transaction,
  ]);

  const transactionType = useWatch({ control: form.control, name: 'type' });
  const transactionAmountValue = useWatch({ control: form.control, name: "amount" });

  const findCategoryName = (id: string, cats: (Category | SubCategory)[]): string | undefined => {
    for (const cat of cats) {
      if (cat.id === id) return cat.name;
      if (cat.subCategories) {
        const found = findCategoryName(id, cat.subCategories);
        if (found) return found;
      }
    }
    return undefined;
  };

  const resolvedAllocations = (): TransactionAllocation[] =>
    allocations.map((allocation) => ({
      id: allocation.id,
      categoryId: allocation.categoryId || undefined,
      category: allocation.categoryId
        ? findCategoryName(allocation.categoryId, categories) ?? "Uncategorized"
        : "Unallocated",
      amount: Number(allocation.amount) || 0,
    }));

  const saveSubmission = async (
    submissionValues: SubmittedTransactionValues,
  ) => {
    try {
      if (transaction && transaction.id) {
        if (onTransactionUpdated) {
          await onTransactionUpdated(transaction.id, submissionValues);
        }
      } else if (onTransactionCreated) {
        await onTransactionCreated(submissionValues);
      }
      if (onOpenChange) onOpenChange(false)
      form.reset()
    } catch (error) {
      setSplitError(error instanceof Error ? error.message : "The transaction could not be saved.");
    }
  };

  async function onSubmit(values: FormValues) {
    if (!isSplit && !values.categoryId) {
      form.setError("categoryId", { message: "Please select a category." });
      return;
    }
    const nextAllocations = isSplit ? resolvedAllocations() : undefined;
    if (isSplit && !allocationsAreComplete(values.amount, nextAllocations)) {
      const difference = allocationDifference(values.amount, nextAllocations);
      setSplitError(
        difference > 0
          ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(difference)} still needs a category.`
          : `The split is ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(difference))} over the transaction total.`,
      );
      return;
    }
    const categoryName = values.categoryId
      ? findCategoryName(values.categoryId, categories)
      : undefined;

    const submissionValues = {
      ...values,
      category: isSplit ? "Split transaction" : categoryName || 'Uncategorized',
      categoryId: isSplit ? "" : values.categoryId,
      allocations: nextAllocations ?? [],
      allocationStatus: "complete" as const,
      // A split is categorized allocation-by-allocation. Keeping a parent
      // envelope here would move the full bank amount in addition to its
      // allocations and would double-count the envelope activity.
      envelopeId:
        !isSplit && values.envelopeId && values.envelopeId !== "none"
          ? values.envelopeId
          : null,
    };

    if (transaction?.id && historicalEditYear !== undefined) {
      setPendingHistoricalUpdate(submissionValues);
      return;
    }

    await saveSubmission(submissionValues);
  }

  const confirmHistoricalUpdate = async () => {
    if (!pendingHistoricalUpdate) return;
    const submission = pendingHistoricalUpdate;
    setPendingHistoricalUpdate(null);
    setIsSavingHistoricalUpdate(true);
    await saveSubmission(submission);
    setIsSavingHistoricalUpdate(false);
  };

  const handleCategoryAdded = (newCategoryName: string, newCategoryId: string) => {
    form.setValue('categoryId', newCategoryId, { shouldValidate: true });
    toast({
      title: "Category Added",
      description: `Successfully added and selected "${newCategoryName}".`,
    });
  }

  const sheetTitle = isEditing ? "Edit Transaction" : "New Transaction";
  const sheetDescription = isEditing 
    ? "Update the details of your transaction." 
    : "Add a new income or expense record. Click save when you're done.";
  const buttonText = isEditing ? "Save Changes" : "Create Transaction";

  const availableCategories = useMemo(() => {
    const typeToFilter = transactionType || 'expense';
    const filtered = categories.filter(c => c.type === typeToFilter);

    const getCategoryOptions = (cats: (Category | SubCategory)[], indent = 0): { label: string; value: string; disabled: boolean, indent: number }[] => {
      let options: { label: string; value: string; disabled: boolean, indent: number }[] = [];
      
      cats.forEach(cat => {
        const hasSubCategories = cat.subCategories && cat.subCategories.length > 0;
        
        options.push({
          label: cat.name,
          value: cat.id,
          disabled: false, // All categories are selectable
          indent,
        });
        
        if (hasSubCategories) {
          options = options.concat(getCategoryOptions(cat.subCategories!, indent + 1));
        }
      });
      return options;
    };
    
    return getCategoryOptions(filtered);
  }, [categories, transactionType]);

  const splitDifference = allocationDifference(
    Number(transactionAmountValue) || 0,
    resolvedAllocations(),
  );

  const toggleSplit = () => {
    setSplitError(null);
    setIsSplit((current) => {
      if (!current && allocations.length === 0) {
        setAllocations([
          {
            id: createAllocationId(),
            categoryId: form.getValues("categoryId") ?? "",
            amount: Number(form.getValues("amount") || 0).toFixed(2),
          },
          { id: createAllocationId(), categoryId: "", amount: "0.00" },
        ]);
      }
      return !current;
    });
  };

  const saveTemplate = async () => {
    const name = templateName.trim();
    const amount = Number(transactionAmountValue) || 0;
    const lines = resolvedAllocations();
    if (!name || !allocationsAreComplete(amount, lines)) {
      setSplitError("Enter a template name and finish the split before saving it.");
      return;
    }
    const template = {
      name,
      type: transactionType ?? "expense",
      lines: lines.map((line) => ({
        category: line.category,
        categoryId: line.categoryId,
        percentage: amount > 0 ? line.amount / amount : 0,
      })),
    };
    try {
      await addTemplate(template);
      setTemplateName("");
      toast({ title: "Split template saved", description: `${name} can be reused on future ${template.type} transactions and devices.` });
    } catch (error) {
      setSplitError(error instanceof Error ? error.message : "The template could not be saved.");
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find((candidate) => candidate.id === templateId);
    const amountInCents = Math.round((Number(transactionAmountValue) || 0) * 100);
    if (!template || template.type !== transactionType || amountInCents <= 0) return;
    let usedCents = 0;
    setAllocations(template.lines.map((line, index) => {
      const lineCents = index === template.lines.length - 1
        ? amountInCents - usedCents
        : Math.round(amountInCents * line.percentage);
      usedCents += lineCents;
      return {
        id: createAllocationId(),
        categoryId: line.categoryId ?? "",
        amount: (lineCents / 100).toFixed(2),
      };
    }));
    setIsSplit(true);
    setSplitError(null);
  };


  return (
    <>
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      {children ? <SheetTrigger asChild>{children}</SheetTrigger> : null}
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{sheetTitle}</SheetTitle>
          <SheetDescription>{sheetDescription}</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
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
            {(transactionType === "expense" || transactionType === "income") &&
            !isSplit &&
            budgetingMode !== "tracking" &&
            activeEnvelopes.length > 0 ? (
              <FormField
                control={form.control}
                name="envelopeId"
                render={({ field }) => {
                  const suggestion = suggestEnvelope({
                    type: transactionType,
                    accountId: form.getValues("accountId"),
                    categoryId: form.getValues("categoryId"),
                  });
                  return (
                    <FormItem>
                      <FormLabel>
                        {transactionType === "income"
                          ? "Refund to envelope"
                          : "Envelope"}
                      </FormLabel>
                      <Select
                        value={field.value ?? "none"}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No envelope" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">
                            No envelope
                          </SelectItem>
                          {activeEnvelopes.map((envelope) => (
                            <SelectItem
                              key={envelope.id}
                              value={envelope.id}
                            >
                              {envelope.name}
                              {suggestion?.id === envelope.id
                                ? " (Suggested)"
                                : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {transactionType === "income"
                          ? "Use this only when income is a refund returning money to an envelope."
                          : "Spending reduces the selected envelope once. Account transfers remain excluded from expenses."}
                      </p>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            ) : null}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Transaction Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.resetField('categoryId');
                        setIsSplit(false);
                        setAllocations([]);
                      }}
                      defaultValue={field.value}
                      className="flex items-center space-x-4"
                      disabled={isEditing}
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="income" />
                        </FormControl>
                        <FormLabel className="font-normal">Income</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="expense" />
                        </FormControl>
                        <FormLabel className="font-normal">Expense</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Coffee, Salary, Rent" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-medium"><Split className="h-4 w-4" /> Split transaction</p>
                  <p className="text-xs text-muted-foreground">Keep one bank transaction while assigning its amount to multiple categories.</p>
                </div>
                <Button type="button" variant={isSplit ? "default" : "outline"} size="sm" onClick={toggleSplit}>
                  {isSplit ? "Split on" : "Add split"}
                </Button>
              </div>
            </div>
            {isSplit ? (
              <div className="space-y-3 rounded-lg border p-3">
                {templates.some((template) => template.type === transactionType) ? (
                  <div className="space-y-1.5">
                    <Label>Apply saved split</Label>
                    <Select onValueChange={applyTemplate}>
                      <SelectTrigger><SelectValue placeholder="Choose a template" /></SelectTrigger>
                      <SelectContent>{templates.filter((template) => template.type === transactionType).map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ) : null}
                {allocations.map((allocation, index) => (
                  <div key={allocation.id} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_8rem_auto]">
                    <div className="space-y-1.5">
                      <Label>Category {index + 1}</Label>
                      <Select value={allocation.categoryId} onValueChange={(value) => setAllocations((current) => current.map((item) => item.id === allocation.id ? { ...item, categoryId: value } : item))}>
                        <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                        <SelectContent>{availableCategories.map((option) => <SelectItem key={option.value} value={option.value} style={{ paddingLeft: `${option.indent * 1.5 + 1}rem` }}>{option.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Amount</Label>
                      <Input type="number" min="0.01" step="0.01" value={allocation.amount} onChange={(event) => setAllocations((current) => current.map((item) => item.id === allocation.id ? { ...item, amount: event.target.value } : item))} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" disabled={allocations.length <= 2} onClick={() => setAllocations((current) => current.filter((item) => item.id !== allocation.id))} aria-label={`Remove allocation ${index + 1}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setAllocations((current) => [...current, { id: createAllocationId(), categoryId: "", amount: "0.00" }])}><PlusCircle className="mr-2 h-4 w-4" /> Add category</Button>
                  <p className={cn("text-sm font-medium tabular-nums", Math.abs(splitDifference) < 0.005 ? "text-emerald-700" : "text-destructive")}>
                    {Math.abs(splitDifference) < 0.005 ? "Fully allocated" : splitDifference > 0 ? `${splitDifference.toLocaleString("en-US", { style: "currency", currency: "USD" })} remaining` : `${Math.abs(splitDifference).toLocaleString("en-US", { style: "currency", currency: "USD" })} over`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name, e.g. Sunday deposit" />
                  <Button type="button" variant="secondary" onClick={() => void saveTemplate()}>Save template</Button>
                </div>
                {templates.filter((template) => template.type === transactionType).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {templates.filter((template) => template.type === transactionType).map((template) => (
                      <Button key={template.id} type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => void deleteTemplate(template.id)} title={`Delete ${template.name}`}>
                        {template.name}<Trash2 className="ml-2 h-3 w-3" />
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableCategories.map((option) => (
                        <SelectItem 
                          key={option.value} 
                          value={option.value} 
                          disabled={option.disabled}
                          style={{ paddingLeft: `${option.indent * 1.5 + 1}rem`}}
                          className={cn(option.disabled && "font-bold text-muted-foreground")}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                      <AddCategoryDialog onCategoryAdded={handleCategoryAdded} type={transactionType || 'expense'} categories={categories}/>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            )}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <FormControl>
                          <Input
                            placeholder="MM/dd/yyyy"
                            value={dateInput}
                            onChange={(e) => {
                                const val = e.target.value;
                                setDateInput(val);
                                const parsedDate = parse(val, "MM/dd/yyyy", new Date());
                                if (isValid(parsedDate)) {
                                    field.onChange(parsedDate);
                                }
                            }}
                          />
                        </FormControl>
                        <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(selectedDate) => {
                            if(selectedDate) {
                                field.onChange(selectedDate);
                                setDateInput(format(selectedDate, "MM/dd/yyyy"));
                            }
                        }}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            {splitError ? <p className="text-sm font-medium text-destructive">{splitError}</p> : null}
            <SheetFooter className="pt-4">
                <SheetClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </SheetClose>
                <Button type="submit">{buttonText}</Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
    <AlertDialog
      open={pendingHistoricalUpdate !== null}
      onOpenChange={(open) => {
        if (!open && !isSavingHistoricalUpdate) {
          setPendingHistoricalUpdate(null);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Update this {historicalEditYear} transaction?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This correction will recalculate {historicalEditYear} account
            balances, reports, comparisons, budgets, goals, projections, and
            designated-fund results. The original bank transaction is updated;
            Ledgerly will not create a duplicate.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSavingHistoricalUpdate}>
            Go back
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isSavingHistoricalUpdate}
            onClick={() => void confirmHistoricalUpdate()}
          >
            Save historical correction
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
