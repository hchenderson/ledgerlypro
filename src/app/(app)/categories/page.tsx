

"use client";

import { useState } from "react";
import * as icons from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Sparkles, Edit, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { NewCategorySheet } from "@/components/new-category-sheet";
import { Badge } from "@/components/ui/badge";
import type { Category, SubCategory } from "@/types";
import { useCategories } from "@/hooks/use-categories";
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
} from "@/components/ui/alert-dialog"
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ExportCategoriesDialog } from "@/components/export-categories-dialog";
import { ImportCategoriesDialog } from "@/components/import-categories-dialog";
import { useAuth } from "@/hooks/use-auth";

function EditCategoryDialog({ 
    name, 
    onSave,
    children,
    isReadOnly,
}: { 
    name: string, 
    onSave: (oldName: string, newName: string) => void,
    children: React.ReactNode,
    isReadOnly: boolean,
}) {
    const [newName, setNewName] = useState(name);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    const handleSave = () => {
        if (newName.trim() && newName !== name) {
            onSave(name, newName);
            toast({ title: "Category Updated", description: "The category name and all associated transactions have been updated."});
        }
        setIsOpen(false);
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Category Name</DialogTitle>
                    <DialogDescription>Enter a new name for this category. All transactions with the old name will be updated.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="category-name">New Name</Label>
                    <Input id="category-name" value={newName} onChange={(e) => setNewName(e.target.value)} disabled={isReadOnly} />
                </div>
                <DialogFooter className="gap-2">
                    <DialogClose asChild><Button variant="outline" className="h-11 sm:h-10">Cancel</Button></DialogClose>
                    <Button onClick={handleSave} disabled={isReadOnly} className="h-11 sm:h-10">Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function SubCategoryList({ items, parentId, parentPath = [] }: { items: SubCategory[], parentId: string, parentPath?: string[] }) {
    const { addSubCategory, updateSubCategory, deleteSubCategory } = useCategories();
    const { activeYear } = useAuth();
    const systemYear = new Date().getFullYear();
    const isReadOnly = activeYear < systemYear;

    const handleAddSubCategory = (parentId: string, subCategoryName: string, path: string[]) => {
        const newSubCategory: Omit<SubCategory, 'id'> = {
            name: subCategoryName,
            icon: 'Sparkles'
        };
        addSubCategory(parentId, newSubCategory, path);
    }

    if (!items || items.length === 0) return null;

    return (
        <div className="ml-2 border-l pl-3 sm:ml-6 sm:pl-6">
            {items.map(sub => {
                const Icon = sub.icon ? (icons as any)[sub.icon] as icons.LucideIcon : Sparkles;
                return (
                    <div key={sub.id} className="py-2">
                        <div className="group flex min-w-0 items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                                <span className="truncate">{sub.name}</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                                <EditCategoryDialog name={sub.name} onSave={(oldName, newName) => updateSubCategory(parentId, sub.id, oldName, newName, parentPath)} isReadOnly={isReadOnly}>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-11 w-11 md:h-10 md:w-10"
                                        disabled={isReadOnly}
                                        aria-label={`Edit ${sub.name}`}
                                    >
                                        <Edit className="h-4 w-4"/>
                                    </Button>
                                </EditCategoryDialog>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-11 w-11 md:h-10 md:w-10"
                                            disabled={isReadOnly}
                                            aria-label={`Delete ${sub.name}`}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500"/>
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete the <strong>{sub.name}</strong> sub-category and any categories within it.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => deleteSubCategory(parentId, sub.id, parentPath)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                        <SubCategoryList items={sub.subCategories || []} parentId={parentId} parentPath={[...parentPath, sub.id]} />
                        
                        {parentPath.length < 1 && (
                            <NewCategorySheet 
                                onAddCategory={(name) => handleAddSubCategory(parentId, name, [...parentPath, sub.id])} 
                                isSubCategory={true}
                                parentCategoryName={sub.name}
                                isReadOnly={isReadOnly}
                            >
                                <button className="ml-7 mt-2 flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary sm:ml-9" disabled={isReadOnly}>
                                    <PlusCircle className="h-4 w-4"/>
                                    Add Sub-category
                                </button>
                            </NewCategorySheet>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

export default function CategoriesPage() {
    const { categories, addCategory, addSubCategory, updateCategory, deleteCategory, importCategories, loading } = useCategories();
    const { toast } = useToast();
    const { activeYear } = useAuth();
    const systemYear = new Date().getFullYear();
    const isReadOnly = activeYear < systemYear;

    const handleAddCategory = (categoryName: string, type: 'income' | 'expense') => {
        const newCategory: Omit<Category, 'id'> = { 
            name: categoryName, 
            icon: 'Sparkles',
            type: type,
        };
        addCategory(newCategory);
    };
    
    const handleAddSubCategory = (parentId: string, subCategoryName: string) => {
        const newSubCategory: Omit<SubCategory, 'id'> = {
            name: subCategoryName,
            icon: 'Sparkles'
        };
        addSubCategory(parentId, newSubCategory);
    }
    
    const handleImport = async (importedData: { name: string; type: 'income' | 'expense'; parent_name: string }[]) => {
        try {
            await importCategories(importedData);
            toast({
                title: "Import Successful",
                description: "Your categories have been imported."
            });
        } catch(e: any) {
            toast({
                variant: 'destructive',
                title: "Import Failed",
                description: e.message
            });
        }
    }

    const renderCategoryList = (filteredCategories: Category[]) => (
         <Accordion type="multiple" className="w-full">
            {filteredCategories.map((category) => {
                const Icon = category.icon ? (icons as any)[category.icon] as icons.LucideIcon : Sparkles;
                return (
                    <AccordionItem value={category.id} key={category.id}>
                        <div className="group flex min-w-0 items-center justify-between">
                            <AccordionTrigger className="min-w-0 flex-1 hover:no-underline">
                                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
                                    <Icon className="h-6 w-6 shrink-0 text-muted-foreground" />
                                    <span className="truncate text-left text-base font-medium">{category.name}</span>
                                    <Badge className="hidden shrink-0 min-[390px]:inline-flex" variant={category.type === 'income' ? 'default' : 'secondary'}>{category.type}</Badge>
                                </div>
                            </AccordionTrigger>
                            <div className="mr-1 flex shrink-0 items-center gap-1 opacity-100 transition-opacity md:mr-2 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                                <EditCategoryDialog name={category.name} onSave={(oldName, newName) => updateCategory(category.id, oldName, newName)} isReadOnly={isReadOnly}>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-11 w-11 md:h-10 md:w-10"
                                        disabled={isReadOnly}
                                        aria-label={`Edit ${category.name}`}
                                    >
                                        <Edit className="h-4 w-4"/>
                                    </Button>
                                </EditCategoryDialog>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-11 w-11 md:h-10 md:w-10"
                                            disabled={isReadOnly}
                                            aria-label={`Delete ${category.name}`}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500"/>
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete the <strong>{category.name}</strong> category and all its sub-categories.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => deleteCategory(category.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                        <AccordionContent>
                            <div className="space-y-3 pl-2 sm:pl-6">
                            <SubCategoryList items={category.subCategories || []} parentId={category.id} />
                                <NewCategorySheet 
                                    onAddCategory={(name) => handleAddSubCategory(category.id, name)} 
                                    isSubCategory={true}
                                    parentCategoryName={category.name}
                                    isReadOnly={isReadOnly}
                                >
                                    <button className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary" disabled={isReadOnly}>
                                        <PlusCircle className="h-4 w-4"/>
                                        Add Sub-category
                                    </button>
                                </NewCategorySheet>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )
            })}
        </Accordion>
    )

    if (loading) {
        return (
             <div className="space-y-6">
                <Card><CardHeader><CardTitle>Loading...</CardTitle></CardHeader></Card>
                <Card><CardHeader><CardTitle>Loading...</CardTitle></CardHeader></Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-2xl font-bold tracking-tight font-headline">Categories</h2>
                    <p className="text-muted-foreground">
                        Organize your transactions with categories and sub-categories.
                    </p>
                </div>
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto [&>button]:h-11 [&>button]:w-full sm:[&>button]:h-10 sm:[&>button]:w-auto [&>button:last-child]:col-span-2">
                    <ImportCategoriesDialog onImport={handleImport}/>
                    <ExportCategoriesDialog categories={categories} />
                    <NewCategorySheet onAddCategory={handleAddCategory} isReadOnly={isReadOnly} />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Income Categories</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                    {renderCategoryList(categories.filter(c => c.type === 'income'))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Expense Categories</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-3 sm:px-6">
                    {renderCategoryList(categories.filter(c => c.type === 'expense'))}
                     <NewCategorySheet onAddCategory={handleAddCategory} isReadOnly={isReadOnly}>
                        <Button variant="ghost" className="w-full mt-2" disabled={isReadOnly}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add New Main Category
                        </Button>
                    </NewCategorySheet>
                </CardContent>
            </Card>
        </div>
    );
}
