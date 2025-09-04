
"use client";

import { useState } from "react";
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


function EditCategoryDialog({ 
    name, 
    onSave,
    children 
}: { 
    name: string, 
    onSave: (newName: string) => void,
    children: React.ReactNode 
}) {
    const [newName, setNewName] = useState(name);
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    const handleSave = () => {
        if (newName.trim() && newName !== name) {
            onSave(newName);
            toast({ title: "Category Updated", description: "The category name has been updated."});
        }
        setIsOpen(false);
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Category Name</DialogTitle>
                    <DialogDescription>Enter a new name for this category.</DialogDescription>
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

export default function CategoriesPage() {
    const { categories, addCategory, addSubCategory, updateCategory, deleteCategory, updateSubCategory, deleteSubCategory, loading } = useUserData();

    const handleAddCategory = (categoryName: string, type: 'income' | 'expense') => {
        const newCategory: Category = { 
            id: `cat_${Date.now()}`,
            name: categoryName, 
            icon: Sparkles, // A real app would have an icon picker
            type: type
        };
        addCategory(newCategory);
    };

    const handleAddSubCategory = (parentId: string, subCategoryName: string) => {
        const newSubCategory: SubCategory = {
            id: `sub_${Date.now()}`,
            name: subCategoryName,
            icon: Sparkles
        };
        addSubCategory(parentId, newSubCategory);
    }

    const renderCategoryList = (filteredCategories: Category[]) => (
         <Accordion type="multiple" className="w-full">
            {filteredCategories.map((category) => (
                <AccordionItem value={category.id} key={category.id}>
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-4 flex-1">
                            <Sparkles className="h-6 w-6 text-muted-foreground" />
                            <span className="text-base font-medium">{category.name}</span>
                             <Badge variant={category.type === 'income' ? 'default' : 'secondary'}>{category.type}</Badge>
                        </div>
                        <div className="flex items-center gap-1 mr-2" onClick={(e) => e.stopPropagation()}>
                            <EditCategoryDialog name={category.name} onSave={(newName) => updateCategory(category.id, newName)}>
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
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="pl-12 space-y-3">
                            {category.subCategories?.map(sub => (
                                <div key={sub.id} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <Sparkles className="h-5 w-5 text-muted-foreground" />
                                        <span>{sub.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                         <EditCategoryDialog name={sub.name} onSave={(newName) => updateSubCategory(category.id, sub.id, newName)}>
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
                                                        This action cannot be undone. This will permanently delete the <strong>{sub.name}</strong> sub-category.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => deleteSubCategory(category.id, sub.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}
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
            ))}
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
                <NewCategorySheet onAddCategory={handleAddCategory} />
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
