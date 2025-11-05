
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
import { useUserData } from "@/hooks/use-user-data";
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


function EditCategoryDialog({ 
    name, 
    onSave,
    children 
}: { 
    name: string, 
    onSave: (oldName: string, newName: string) => void,
    children: React.ReactNode 
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
                    <Input id="category-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function SubCategoryList({ items, parentId, parentPath = [] }: { items: SubCategory[], parentId: string, parentPath?: string[] }) {
    const { addSubCategory, updateSubCategory, deleteSubCategory } = useUserData();

    const handleAddSubCategory = (parentId: string, subCategoryName: string, path: string[]) => {
        const newSubCategory: Omit<SubCategory, 'id'> = {
            name: subCategoryName,
            icon: 'Sparkles'
        };
        addSubCategory(parentId, newSubCategory, path);
    }

    if (!items || items.length === 0) return null;

    return (
        <div className="pl-6 border-l ml-6">
            {items.map(sub => {
                const Icon = sub.icon ? (icons as any)[sub.icon] as icons.LucideIcon : Sparkles;
                return (
                    <div key={sub.id} className="py-2">
                        <div className="flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <Icon className="h-5 w-5 text-muted-foreground" />
                                <span>{sub.name}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <EditCategoryDialog name={sub.name} onSave={(oldName, newName) => updateSubCategory(parentId, sub.id, oldName, newName, parentPath)}>
                                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4"/></Button>
                                </EditCategoryDialog>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-red-500"/></Button>
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
                            >
                                <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors ml-9 mt-2">
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
    const { categories, addCategory, addSubCategory, updateCategory, deleteCategory, importCategories, loading } = useUserData();
    const { toast } = useToast();

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
                        <div className="flex items-center justify-between group">
                            <AccordionTrigger className="hover:no-underline flex-1">
                                <div className="flex items-center gap-4 flex-1">
                                    <Icon className="h-6 w-6 text-muted-foreground" />
                                    <span className="text-base font-medium">{category.name}</span>
                                    <Badge variant={category.type === 'income' ? 'default' : 'secondary'}>{category.type}</Badge>
                                </div>
                            </AccordionTrigger>
                            <div className="flex items-center gap-1 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <EditCategoryDialog name={category.name} onSave={(oldName, newName) => updateCategory(category.id, oldName, newName)}>
                                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4"/></Button>
                                </EditCategoryDialog>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-red-500"/></Button>
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
                            <div className="pl-6 space-y-3">
                            <SubCategoryList items={category.subCategories || []} parentId={category.id} />
                                <NewCategorySheet 
                                    onAddCategory={(name) => handleAddSubCategory(category.id, name)} 
                                    isSubCategory={true}
                                    parentCategoryName={category.name}
                                >
                                    <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
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
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight font-headline">Categories</h2>
                    <p className="text-muted-foreground">
                        Organize your transactions with categories and sub-categories.
                    </p>
                </div>
                <div className="flex gap-2">
                    <ImportCategoriesDialog onImport={handleImport}/>
                    <ExportCategoriesDialog categories={categories} />
                    <NewCategorySheet onAddCategory={handleAddCategory} />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Income Categories</CardTitle>
                </CardHeader>
                <CardContent>
                    {renderCategoryList(categories.filter(c => c.type === 'income'))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Expense Categories</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {renderCategoryList(categories.filter(c => c.type === 'expense'))}
                     <NewCategorySheet onAddCategory={handleAddCategory}>
                        <Button variant="ghost" className="w-full mt-2">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add New Main Category
                        </Button>
                    </NewCategorySheet>
                </CardContent>
            </Card>
        </div>
    );
}
