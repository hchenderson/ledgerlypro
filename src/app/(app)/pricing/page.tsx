import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const features = [
    "Unlimited Transactions",
    "Custom Categories",
    "Detailed Reports",
    "Data Export (CSV/PDF)",
    "Receipt Scanning",
    "AI Cash Flow Projections",
    "Cloud Sync",
]

export default function PricingPage() {
    return (
        <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
                <h1 className="font-headline text-4xl font-extrabold tracking-tight lg:text-5xl">
                    Find the Perfect Plan
                </h1>
                <p className="mt-4 text-lg text-muted-foreground">
                    Unlock powerful bookkeeping features. Cancel anytime.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-2xl">Monthly</CardTitle>
                        <CardDescription>Perfect for trying things out.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-baseline gap-2">
                             <span className="text-5xl font-bold font-code">$4.99</span>
                             <span className="text-muted-foreground">/ month</span>
                        </div>
                         <ul className="space-y-3">
                            {features.map(feature => (
                                <li key={feature} className="flex items-center gap-2">
                                    <Check className="h-5 w-5 text-primary" />
                                    <span className="text-muted-foreground">{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" variant="outline">Choose Monthly</Button>
                    </CardFooter>
                </Card>

                <Card className="border-2 border-primary relative">
                     <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-2xl">Yearly</CardTitle>
                        <CardDescription>Save 30% and get the best value.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-baseline gap-2">
                             <span className="text-5xl font-bold font-code">$39.99</span>
                             <span className="text-muted-foreground">/ year</span>
                        </div>
                        <ul className="space-y-3">
                            {features.map(feature => (
                                <li key={feature} className="flex items-center gap-2">
                                    <Check className="h-5 w-5 text-primary" />
                                    <span className="text-foreground font-medium">{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full">Choose Yearly</Button>
                    </CardFooter>
                </Card>
            </div>
             <p className="text-center text-sm text-muted-foreground mt-8">
                All plans start with a 14-day free trial.
            </p>
        </div>
    )
}
