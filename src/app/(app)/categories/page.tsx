
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Utensils, Car, Home, ShoppingBag, HeartPulse, Sparkles, HandCoins, Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NewCategorySheet, Category } from "@/components/new-category-sheet";

const preloadedCategories = [
    { name: "Food", icon: Utensils },
    { name: "Transport", icon: Car },
    { name: "Housing", icon: Home },
    { name: "Shopping", icon: ShoppingBag },
    { name: "Health", icon: HeartPulse },
    { name: "Salary", icon: HandCoins },
]

const initialCustomCategories: Category[] = [
    { name: "Freelance", icon: Sparkles },
    { name: "Investments", icon: Sparkles },
    { name: "Social", icon: Sparkles },
]

export default function CategoriesPage() {
    const [customCategories, setCustomCategories] = useState<Category[]>(initialCustomCategories);

    const handleAddCategory = (categoryName: string) => {
        const newCategory = { name: categoryName, icon: Sparkles };
        setCustomCategories(prev => [...prev, newCategory]);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight font-headline">Categories</h2>
                    <p className="text-muted-foreground">
                        Organize your transactions with categories.
                    </p>
                </div>
                <NewCategorySheet onAddCategory={handleAddCategory} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Default Categories</CardTitle>
                    <CardDescription>Standard categories to get you started.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {preloadedCategories.map(category => (
                        <div key={category.name} className="flex flex-col items-center justify-center gap-2 rounded-lg border p-4 transition-colors hover:bg-accent hover:text-accent-foreground">
                            <category.icon className="h-8 w-8 text-muted-foreground" />
                            <span className="text-sm font-medium">{category.name}</span>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Custom Categories</CardTitle>
                    <CardDescription>Your personalized categories.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {customCategories.map(category => (
                        <div key={category.name} className="relative flex flex-col items-center justify-center gap-2 rounded-lg border p-4 transition-colors hover:bg-accent hover:text-accent-foreground">
                            <Badge variant="secondary" className="absolute top-2 right-2">Custom</Badge>
                            <category.icon className="h-8 w-8 text-muted-foreground" />
                            <span className="text-sm font-medium">{category.name}</span>
                        </div>
                    ))}
                    <NewCategorySheet onAddCategory={handleAddCategory} isTriggerCard>
                        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer h-full">
                            <PlusCircle className="h-8 w-8" />
                            <span className="text-sm font-medium text-center">Add New</span>
                        </div>
                    </NewCategorySheet>
                </CardContent>
            </Card>
        </div>
    );
}
