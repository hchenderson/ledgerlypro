
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validPromoCodes } from '@/lib/promo-codes';

const freeFeatures = [
    { text: "Up to 50 transactions/month", included: true },
    { text: "Custom categories", included: true },
    { text: "Basic reports", included: true },
    { text: "Data Export (CSV/PDF)", included: false },
    { text: "Receipt Scanning", included: false },
    { text: "AI Cash Flow Projections", included: false },
    { text: "Priority Support", included: false },
];

const proFeatures = [
    { text: "Unlimited Transactions", included: true },
    { text: "Detailed Reports & Export", included: true },
    { text: "Receipt Scanning", included: true },
    { text: "AI Cash Flow Projections", included: true },
    { text: "Savings Goals & Recurring", included: true },
    { text: "Cloud Sync", included: true },
    { text: "Priority Support", included: true },
];


const ProductDisplay = () => {
    const { plan, setPlan } = useAuth();
    const { toast } = useToast();
    const [promoCode, setPromoCode] = useState('');
    const [promoApplied, setPromoApplied] = useState(false);

    const handleChoosePlan = (newPlan: 'free' | 'pro') => {
        setPlan(newPlan);
        toast({
            title: "Plan Updated!",
            description: `You are now on the ${newPlan === 'pro' ? 'Pro' : 'Free'} plan.`
        })
    }

    const handleApplyPromo = () => {
        if(validPromoCodes.includes(promoCode.toUpperCase())) {
            setPromoApplied(true);
            toast({
                title: 'Promo Code Applied!',
                description: 'You have unlocked the Pro plan for free.',
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'Invalid Promo Code',
                description: 'The code you entered is not valid. Please try again.',
            });
        }
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
            
            {!promoApplied && plan !== 'pro' && (
                <Card className="max-w-md mx-auto mb-8">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Sparkles className="text-primary"/> Have a Promo Code?</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-end gap-2">
                        <div className="w-full space-y-2">
                            <Label htmlFor="promo-code">Promo Code</Label>
                            <Input 
                                id="promo-code" 
                                placeholder="Enter your code" 
                                value={promoCode} 
                                onChange={(e) => setPromoCode(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleApplyPromo}>Apply</Button>
                    </CardContent>
                </Card>
            )}

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
                                    <span className={feature.included ? "text-foreground" : "text-muted-foreground"}>{feature.text}</span>
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
                            {promoApplied ? (
                                <>
                                    <span className="text-5xl font-bold font-code text-primary line-through">$9.99</span>
                                    <span className="text-5xl font-bold font-code">$0</span>
                                </>
                            ) : (
                                <span className="text-5xl font-bold font-code">$9.99</span>
                            )}
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
                            <Button className="w-full" variant={promoApplied ? "default" : "outline"} onClick={() => handleChoosePlan('pro')}>
                                {promoApplied ? "Activate Pro" : "Choose Monthly"}
                            </Button>
                        )}
                    </CardFooter>
                </Card>

                <Card className="border-2 border-primary relative">
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>
                    <CardHeader className="pb-4">
                        <CardTitle className="text-2xl">Pro Yearly</CardTitle>
                        <CardDescription>Save over 17% and get the best value.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col items-start gap-2">
                            <div className="flex items-baseline gap-2">
                                {promoApplied ? (
                                    <>
                                        <span className="text-5xl font-bold font-code text-primary line-through">$99</span>
                                        <span className="text-5xl font-bold font-code">$0</span>
                                    </>
                                ) : (
                                    <span className="text-5xl font-bold font-code">$99</span>
                                )}
                                <span className="text-muted-foreground self-end">/ year</span>
                            </div>
                            {!promoApplied && <p className="text-sm text-muted-foreground">Equivalent to $8.25/month</p>}
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
                           <Button className="w-full" onClick={() => handleChoosePlan('pro')}>
                             {promoApplied ? "Activate Pro" : "Choose Yearly"}
                           </Button>
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
