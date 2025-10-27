
"use client"

import { useState, useEffect, useMemo } from "react"
import { z } from "zod"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format, isValid, parse } from "date-fns"
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
  SelectGroup,
  SelectLabel,
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
    onTransactionCreated?: (values: FormValues) => void;
    onTransactionUpdated?: (id: string, values: FormValues) => void;
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
  const { toast } = useToast()
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  })

  const isEditing = !!transaction?.id;

  // State for the text input for the date
  const [dateInput, setDateInput] = useState("");
  
  useEffect(() => {
    if (isOpen) {
      if (transaction) {
        const transactionDate = transaction.date ? new Date(transaction.date) : new Date();
        form.reset({
          ...transaction,
          date: transactionDate,
          amount: transaction.amount || ('' as any),
          category: transaction.category || undefined,
        });
        setDateInput(format(transactionDate, "MM/dd/yyyy"));
      } else {
        const today = new Date();
        form.reset({
          type: 'expense',
          description: '',
          amount: '' as any,
          category: undefined,
          date: today,
        });
        setDateInput(format(today, "MM/dd/yyyy"));
      }
    }
  }, [transaction, form, isOpen]);

  const transactionType = useWatch({ control: form.control, name: 'type' });

  async function onSubmit(values: FormValues) {
    if (transaction && transaction.id) {
        if(onTransactionUpdated) {
            onTransactionUpdated(transaction.id, values);
        }
    } else {
        if (onTransactionCreated) {
            onTransactionCreated(values);
        }
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

  const sheetTitle = isEditing ? "Edit Transaction" : "New Transaction";
  const sheetDescription = isEditing 
    ? "Update the details of your transaction." 
    : "Add a new income or expense record. Click save when you're done.";
  const buttonText = isEditing ? "Save Changes" : "Create Transaction";

  const availableCategories = useMemo(() => {
    const typeToFilter = isEditing ? transaction?.type : transactionType;
    const filtered = categories.filter(c => c.type === typeToFilter);

    const getCategoryOptions = (cats: (Category | SubCategory)[], indent = 0): { label: string; value: string; disabled: boolean, indent: number }[] => {
      let options: { label: string; value: string; disabled: boolean, indent: number }[] = [];
      
      cats.forEach(cat => {
        const hasSubCategories = cat.subCategories && cat.subCategories.length > 0;
        const isLeaf = !hasSubCategories;

        options.push({
          label: cat.name,
          value: cat.name,
          disabled: !isLeaf,
          indent,
        });
        
        if (hasSubCategories) {
          options = options.concat(getCategoryOptions(cat.subCategories!, indent + 1));
        }
      });
      return options;
    };
    
    return getCategoryOptions(filtered);
  }, [categories, transactionType, isEditing, transaction?.type]);


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
