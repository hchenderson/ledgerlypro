
"use client"

import { useState, type ReactNode } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
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
import { useToast } from "@/hooks/use-toast"
import { RadioGroup, RadioGroupItem } from "./ui/radio-group"

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Category name must be at least 2 characters.",
  }),
  type: z.enum(['income', 'expense']).optional(),
})

interface NewCategorySheetProps {
    onAddCategory: (name: string, type?: 'income' | 'expense') => void;
    children?: ReactNode;
    isSubCategory?: boolean;
    parentCategoryName?: string;
}

export function NewCategorySheet({ 
    onAddCategory, 
    children,
    isSubCategory = false,
    parentCategoryName
}: NewCategorySheetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { toast } = useToast()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "expense"
    },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    onAddCategory(values.name, values.type);
    toast({
      title: isSubCategory ? "Sub-category Created" : "Category Created",
      description: `The "${values.name}" category has been successfully added.`,
    })
    setIsOpen(false)
    form.reset()
  }

  const title = isSubCategory ? `New Sub-category for ${parentCategoryName}` : "New Category";
  const description = isSubCategory 
    ? "Add a new sub-category to organize transactions further."
    : "Create a new category to organize your transactions. Click save when you're done.";
  const buttonText = isSubCategory ? "Add Sub-category" : "Add Category";
  const placeholder = isSubCategory ? "e.g. Groceries" : "e.g. Business Expenses";


  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {children ? (
            <div onClick={(e) => { e.stopPropagation(); setIsOpen(true) }}>{children}</div>
        ) : (
            <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                {buttonText}
            </Button>
        )}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {description}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder={placeholder} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isSubCategory && (
                <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Category Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
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
            )}
            <SheetFooter className="pt-4">
                <SheetClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </SheetClose>
                <Button type="submit">Save</Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
