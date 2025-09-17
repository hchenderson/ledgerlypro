
"use client"

import { useState, useEffect, useMemo } from "react"
import { z } from "zod"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import * as icons from "lucide-react"
import { Calendar as CalendarIcon, PlusCircle } from "lucide-react"

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
  SheetTrigger,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import type { Transaction, Category, SubCategory } from "@/types"
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
import { useUserData } from "@/hooks/use-user-data"

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
  category: z.string({
    required_error: "Please select a category.",
  }),
})

type FormValues = z.infer<typeof formSchema>

interface NewTransactionSheetProps {
    isOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
    transaction?: Partial<Omit<Transaction, 'id'>> & { id: string } | null;
    onTransactionCreated?: () => void;
    onTransactionUpdated?: () => void;
    children?: React.ReactNode;
    categories: Category[];
}

const AddCategoryDialog = ({ 
    type, 
    categories,
    onCategoryAdded
}: { 
    type: 'income' | 'expense', 
    categories: Category[],
    onCategoryAdded: (newCategoryName: string) => void
}) => {
    const [name, setName] = useState('');
    const [parent, setParent] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const { addCategory, addSubCategory } = useUserData();

    const mainCategories = categories.filter(c => c.type === type);
    
    const handleSubmit = async () => {
        if (!name) return;
        
        if(parent) {
            const parentId = parent.split(':')[0];
            const parentPath = parent.split(':').slice(1);
            const newSubCategory: Omit<SubCategory, 'id'> = { name, icon: 'Sparkles' };
            await addSubCategory(parentId, newSubCategory, parentPath);
        } else {
            const newCategory: Omit<Category, 'id'> = { name, type, icon: 'Sparkles', subCategories: [] };
            await addCategory(newCategory);
        }

        onCategoryAdded(name);
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
}: NewTransactionSheetProps) {
  const { addTransaction, updateTransaction } = useUserData();
  const { toast } = useToast()
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  })
  
  useEffect(() => {
    if (isOpen) {
      if (transaction) {
        form.reset({
          ...transaction,
          date: transaction.date ? new Date(transaction.date) : new Date(),
          amount: transaction.amount || ('' as any),
          category: transaction.category || undefined,
        });
      } else {
        form.reset({
          type: 'expense',
          description: '',
          amount: '' as any,
          category: undefined,
          date: new Date(),
        });
      }
    }
  }, [transaction, form, isOpen]);

  const transactionType = useWatch({ control: form.control, name: 'type' });

  async function onSubmit(values: FormValues) {
    const data = {
        ...values,
        date: values.date.toISOString(),
    };
    if (transaction && transaction.id && updateTransaction) {
        await updateTransaction(transaction.id, data);
        if (onTransactionUpdated) onTransactionUpdated();
    } else if(addTransaction) {
        await addTransaction(data);
        if (onTransactionCreated) onTransactionCreated();
    }

    if(onOpenChange) onOpenChange(false)
    form.reset()
  }

  const handleCategoryAdded = (newCategoryName: string) => {
    form.setValue('category', newCategoryName, { shouldValidate: true });
    toast({
      title: "Category Added",
      description: `Successfully added and selected "${newCategoryName}".`,
    });
  }

  const isEditing = !!transaction?.id;
  const sheetTitle = isEditing ? "Edit Transaction" : "New Transaction";
  const sheetDescription = isEditing 
    ? "Update the details of your transaction." 
    : "Add a new income or expense record. Click save when you're done.";
  const buttonText = isEditing ? "Save Changes" : "Create Transaction";

  const availableCategories = useMemo(() => {
      const filtered = categories.filter(c => c.type === transactionType);
      
      const groupedCategories: Record<string, {name: string, id: string}[]> = {};

      const processCategories = (cats: Category[] | SubCategory[], groupName: string) => {
          cats.forEach(c => {
              if (c.subCategories && c.subCategories.length > 0) {
                  processCategories(c.subCategories, c.name);
              } 
              if (!groupedCategories[groupName]) {
                  groupedCategories[groupName] = [];
              }
               groupedCategories[groupName].push({ name: c.name, id: c.id });
          })
      }

      filtered.forEach(c => {
          if (c.subCategories && c.subCategories.length > 0) {
              processCategories(c.subCategories, c.name);
          }
          if (!groupedCategories['Main Categories']) {
              groupedCategories['Main Categories'] = [];
          }
          groupedCategories['Main Categories'].push({ name: c.name, id: c.id });
      })

      return groupedCategories;
  }, [categories, transactionType]);


  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{sheetTitle}</SheetTitle>
          <SheetDescription>{sheetDescription}</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                        form.resetField('category');
                      }}
                      defaultValue={field.value}
                      className="flex items-center space-x-4"
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
            <FormField
              control={form.control}
              name="category"
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
                      {Object.entries(availableCategories).map(([groupName, groupCategories]) => (
                        <SelectGroup key={groupName}>
                            <Label className="px-2 text-xs text-muted-foreground">{groupName}</Label>
                            {groupCategories.map(cat => (
                                <SelectItem key={cat.id} value={cat.name}>
                                    {cat.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                      ))}
                      <AddCategoryDialog onCategoryAdded={handleCategoryAdded} type={transactionType || 'expense'} categories={categories}/>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
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
  )
}
