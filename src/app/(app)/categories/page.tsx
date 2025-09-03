
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Utensils, Car, Home, ShoppingBag, HeartPulse, Sparkles, HandCoins, Building, Shirt, Pizza, Plane, LucideIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { NewCategorySheet } from "@/components/new-category-sheet";
import { Badge } from "@/components/ui/badge";

export type SubCategory = {
    id: string;
    name: string;
    icon: LucideIcon;
};

export type Category = {
    id: string;
    name: string;
    icon: LucideIcon;
    subCategories?: SubCategory[];
};


const preloadedCategories: Category[] = [
    { id: "cat_1", name: "Food", icon: Utensils, subCategories: [
        { id: "sub_1", name: "Groceries", icon: ShoppingBag },
        { id: "sub_2", name: "Restaurants", icon: Pizza },
    ]},
    { id: "cat_2", name: "Transport", icon: Car, subCategories: [
        { id: "sub_3", name: "Gas", icon: Car },
        { id: "sub_4", name: "Public Transit", icon: Car },
    ] },
    { id: "cat_3", name: "Housing", icon: Home, subCategories: [
        { id: "sub_5", name: "Rent", icon: Home },
        { id: "sub_6", name: "Utilities", icon: Home },
    ]},
    { id: "cat_4", name: "Shopping", icon: ShoppingBag, subCategories: [
        { id: "sub_7", name: "Clothes", icon: Shirt },
        { id: "sub_8", name: "Electronics", icon: Sparkles },
    ]},
    { id: "cat_5", name: "Health", icon: HeartPulse },
    { id: "cat_6", name: "Salary", icon: HandCoins },
]

const initialCustomCategories: Category[] = [
    { id: "cat_7", name: "Business", icon: Building, subCategories: [
        { id: "sub_9", name: "Travel", icon: Plane },
        { id: "sub_10", name: "Software", icon: Sparkles },
    ]},
    { id: "cat_8", name: "Freelance", icon: Sparkles },
]


export default function CategoriesPage() {
    const [customCategories, setCustomCategories] = useState<Category[]>(initialCustomCategories);

    const handleAddCategory = (categoryName: string) => {
        const newCategory: Category = { 
            id: `cat_${Date.now()}`,
            name: categoryName, 
            icon: Sparkles 
        };
        setCustomCategories(prev => [...prev, newCategory]);
    };

    const handleAddSubCategory = (parentId: string, subCategoryName: string) => {
        const newSubCategory: SubCategory = {
            id: `sub_${Date.now()}`,
            name: subCategoryName,
            icon: Sparkles
        };

        const updateCategories = (categories: Category[]): Category[] => {
            return categories.map(cat => {
                if (cat.id === parentId) {
                    return {
                        ...cat,
                        subCategories: [...(cat.subCategories || []), newSubCategory]
                    };
                }
                return cat;
            });
        };

        setCustomCategories(updateCategories);
    }

    const renderCategoryList = (categories: Category[], isCustom: boolean) => (
         <Accordion type="multiple" className="w-full">
            {categories.map((category) => (
                <AccordionItem value={category.id} key={category.id}>
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-4">
                            <category.icon className="h-6 w-6 text-muted-foreground" />
                            <span className="text-base font-medium">{category.name}</span>
                             {isCustom && <Badge variant="secondary">Custom</Badge>}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="pl-12 space-y-3">
                            {category.subCategories?.map(sub => (
                                <div key={sub.id} className="flex items-center gap-4">
                                     <sub.icon className="h-5 w-5 text-muted-foreground" />
                                     <span>{sub.name}</span>
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
                    <CardTitle>Default Categories</CardTitle>
                    <CardDescription>Standard categories to get you started.</CardDescription>
                </CardHeader>
                <CardContent>
                    {renderCategoryList(preloadedCategories, false)}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Custom Categories</CardTitle>
                    <CardDescription>Your personalized categories. Click to expand and add sub-categories.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {renderCategoryList(customCategories, true)}
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

