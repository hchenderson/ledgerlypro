
"use client"

import { useState, useEffect } from "react"
import { z } from "zod"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { Calendar as CalendarIcon, PlusCircle, Sparkles } from "lucide-react"

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
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { allCategories } from "@/lib/data"
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
    transaction?: Transaction | null;
    onTransactionCreated?: (values: FormValues) => void;
    onTransactionUpdated?: (id: string, values: FormValues) => void;
    children?: React.ReactNode;
}

const AddCategoryDialog = ({ onCategoryAdded, type }: { onCategoryAdded: (name: string) => void, type: 'income' | 'expense' }) => {
    const [name, setName] = useState('');
    const [parent, setParent] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const mainCategories = allCategories.filter(c => c.type === type);

    const handleSubmit = () => {
        if (!name || !parent) return;
        
        // This is a simplified way to add a category. 
        // In a real app, this would be a more robust state management call.
        const parentCategory = allCategories.find(c => c.id === parent);
        if (parentCategory) {
            if (!parentCategory.subCategories) {
                parentCategory.subCategories = [];
            }
            parentCategory.subCategories.push({
                id: `sub_${Date.now()}`,
                name: name,
                icon: Sparkles
            });
        }
        onCategoryAdded(name);
        setIsOpen(false);
        setName('');
        setParent('');
    }

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
                    <DialogDescription>Create a new sub-category to organize your transaction.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Main Category</Label>
                        <Select onValueChange={setParent} value={parent}>
                            <SelectTrigger>
                                <SelectValue placeholder={`Select a parent ${type} category`} />
                            </SelectTrigger>
                            <SelectContent>
                                {mainCategories.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="category-name">New Sub-Category Name</Label>
                        <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Coffee" />
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
    children
}: NewTransactionSheetProps) {
  const { toast } = useToast()
  
  const [categories, setCategories] = useState(allCategories);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  })
  
  useEffect(() => {
    if (transaction) {
      form.reset({
        ...transaction,
        date: new Date(transaction.date),
      });
    } else {
      form.reset({
        type: 'expense',
        description: '',
        amount: undefined,
        category: undefined,
        date: new Date(),
      })
    }
  }, [transaction, form, isOpen]) // Rerun on open to get fresh categories

  const transactionType = useWatch({ control: form.control, name: 'type' });

  function onSubmit(values: FormValues) {
    if (transaction && onTransactionUpdated) {
        onTransactionUpdated(transaction.id, values);
         toast({
            title: "Transaction Updated",
            description: "Your transaction has been successfully updated.",
        });
    } else if(onTransactionCreated) {
        onTransactionCreated(values);
        toast({
            title: "Transaction Created",
            description: "Your new transaction has been successfully recorded.",
        });
    }

    if(onOpenChange) onOpenChange(false)
    form.reset()
  }

  const handleCategoryAdded = (newCategoryName: string) => {
    // A bit of a hack to force a re-render of the select
    setCategories([...allCategories]); 
    form.setValue('category', newCategoryName, { shouldValidate: true });
     toast({
        title: "Category Added",
        description: `Successfully added and selected "${newCategoryName}".`,
    });
  }

  const isEditing = !!transaction;
  const sheetTitle = isEditing ? "Edit Transaction" : "New Transaction";
  const sheetDescription = isEditing 
    ? "Update the details of your transaction." 
    : "Add a new income or expense record. Click save when you're done.";
  const buttonText = isEditing ? "Save Changes" : "Create Transaction";

  const availableCategories = categories
    .filter(cat => cat.type === transactionType)
    .flatMap(cat => cat.subCategories ? cat.subCategories.map(sub => ({...sub, parent: cat.name})) : [{ id: cat.id, name: cat.name, parent: 'Main Categories' }])

  const sheetContent = (
      <>
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
                      {availableCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name} <span className="text-muted-foreground/80 ml-2">({cat.parent})</span>
                        </SelectItem>
                      ))}
                      <AddCategoryDialog onCategoryAdded={handleCategoryAdded} type={transactionType} />
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
      </>
  )

  if (children) {
    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetTrigger asChild>
                {children}
            </SheetTrigger>
            <SheetContent>
                {sheetContent}
            </SheetContent>
        </Sheet>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        {sheetContent}
      </SheetContent>
    </Sheet>
  )
}
