
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

const freeFeatures = [
    { text: "Up to 100 transactions", included: true },
    { text: "Custom categories", included: true },
    { text: "Basic reports", included: true },
    { text: "Data Export (CSV/PDF)", included: false },
    { text: "Receipt Scanning", included: false },
    { text: "AI Cash Flow Projections", included: false },
    { text: "Cloud Sync", included: false },
];

const proFeatures = [
    { text: "Unlimited Transactions", included: true },
    { text: "Custom Categories", included: true },
    { text: "Detailed Reports", included: true },
    { text: "Data Export (CSV/PDF)", included: true },
    { text: "Receipt Scanning", included: true },
    { text: "AI Cash Flow Projections", included: true },
    { text: "Cloud Sync", included: true },
];


const ProductDisplay = () => {
    const { plan, setPlan } = useAuth();
    const { toast } = useToast();

    const handleChoosePlan = (newPlan: 'free' | 'pro') => {
        setPlan(newPlan);
        toast({
            title: "Plan Updated!",
            description: `You are now on the ${newPlan} plan.`
        })
    }
    
    return (
        <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
                <h1 className="font-headline text-4xl font-extrabold tracking-tight lg:text-5xl">
                    Find the Perfect Plan
                </h1>
                <p className="mt-4 text-lg text-muted-foreground">
                    Start for free, or unlock powerful bookkeeping features. Cancel anytime.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-2xl">Free</CardTitle>
                        <CardDescription>For getting started with the basics.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-bold font-code">$0</span>
                                <span className="text-muted-foreground">/ month</span>
                        </div>
                            <ul className="space-y-3">
                            {freeFeatures.map(feature => (
                                <li key={feature.text} className="flex items-center gap-2">
                                    {feature.included ? <Check className="h-5 w-5 text-primary" /> : <X className="h-5 w-5 text-muted-foreground" />}
                                    <span className={feature.included ? "text-foreground" : "text-muted-foreground line-through"}>{feature.text}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                    <CardFooter>
                         {plan === 'free' ? (
                            <Button className="w-full" variant="outline" disabled>Current Plan</Button>
                        ) : (
                            <Button className="w-full" variant="outline" onClick={() => handleChoosePlan('free')}>Downgrade</Button>
                        )}
                    </CardFooter>
                </Card>
                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-2xl">Pro Monthly</CardTitle>
                        <CardDescription>Perfect for trying out pro features.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-bold font-code">$4.99</span>
                                <span className="text-muted-foreground">/ month</span>
                        </div>
                            <ul className="space-y-3">
                            {proFeatures.map(feature => (
                                <li key={feature.text} className="flex items-center gap-2">
                                        <Check className="h-5 w-5 text-primary" />
                                    <span className="text-foreground">{feature.text}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                    <CardFooter>
                       {plan === 'pro' ? (
                            <Button className="w-full" disabled>Current Plan</Button>
                        ) : (
                            <Button className="w-full" variant="outline" onClick={() => handleChoosePlan('pro')}>Choose Monthly</Button>
                        )}
                    </CardFooter>
                </Card>

                <Card className="border-2 border-primary relative">
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-2xl">Pro Yearly</CardTitle>
                        <CardDescription>Save 30% and get the best value.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-bold font-code">$39.99</span>
                                <span className="text-muted-foreground">/ year</span>
                        </div>
                        <ul className="space-y-3">
                            {proFeatures.map(feature => (
                                <li key={feature.text} className="flex items-center gap-2">
                                    <Check className="h-5 w-5 text-primary" />
                                    <span className="text-foreground font-medium">{feature.text}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                    <CardFooter>
                        {plan === 'pro' ? (
                            <Button className="w-full" disabled>Current Plan</Button>
                        ) : (
                           <Button className="w-full" onClick={() => handleChoosePlan('pro')}>Choose Yearly</Button>
                        )}
                    </CardFooter>
                </Card>
            </div>
                <p className="text-center text-sm text-muted-foreground mt-8">
                This is a demo. Clicking a button will update your plan status locally.
            </p>
        </div>
    );
}

export default function PricingPage() {
    return <ProductDisplay />;
}
