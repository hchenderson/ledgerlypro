import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Utensils, Car, Home, ShoppingBag, HeartPulse, Sparkles, HandCoins } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const preloadedCategories = [
    { name: "Food", icon: Utensils },
    { name: "Transport", icon: Car },
    { name: "Housing", icon: Home },
    { name: "Shopping", icon: ShoppingBag },
    { name: "Health", icon: HeartPulse },
    { name: "Salary", icon: HandCoins },
]

const customCategories = [
    { name: "Freelance", icon: Sparkles },
    { name: "Investments", icon: Sparkles },
    { name: "Social", icon: Sparkles },
]


export default function CategoriesPage() {
  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-bold tracking-tight font-headline">Categories</h2>
                <p className="text-muted-foreground">
                    Organize your transactions with categories.
                </p>
            </div>
            <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Category
            </Button>
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
                 <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer">
                    <PlusCircle className="h-8 w-8" />
                    <span className="text-sm font-medium text-center">Add New</span>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
