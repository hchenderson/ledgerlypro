
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getStripe } from '@/lib/stripe';
import { useRouter } from 'next/navigation';

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
    const { plan, setPlan, user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState<string | null>(null);

    const handleCreateCheckout = async (priceId: string) => {
        if (!user) {
            toast({
                variant: 'destructive',
                title: 'Not signed in',
                description: 'You must be signed in to purchase a plan.'
            });
            return;
        }
        
        setIsLoading(priceId);

        try {
            const res = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    priceId,
                    userId: user.uid,
                    email: user.email,
                }),
            });

            if (!res.ok) {
                 const errorBody = await res.json().catch(() => ({ error: 'Failed to parse error body' }));
                 throw new Error(`Failed to create checkout session: ${res.statusText} - ${errorBody.error || 'No additional error info'}`);
            }

            const { sessionId } = await res.json();
            const stripe = await getStripe();
            if (stripe) {
                const { error } = await stripe.redirectToCheckout({ sessionId });
                if (error) {
                    throw new Error(error.message);
                }
            }

        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({
                variant: 'destructive',
                title: 'Checkout Error',
                description: `Could not proceed to checkout. ${errorMessage}`,
            });
        } finally {
            setIsLoading(null);
        }
    }

    
    const handleFreePlan = () => {
        setPlan('free');
        toast({
            title: "You are on the Free Plan",
            description: "You have been successfully downgraded to the free plan."
        });
        router.push('/dashboard');
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
                                    <span className={feature.included ? "text-foreground" : "text-muted-foreground"}>{feature.text}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                    <CardFooter>
                        {plan === 'free' ? (
                            <Button className="w-full" variant="outline" disabled>Current Plan</Button>
                        ) : (
                            <Button className="w-full" variant="outline" onClick={handleFreePlan}>Downgrade</Button>
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
                            <span className="text-5xl font-bold font-code">$9.99</span>
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
                             <Button 
                                className="w-full" 
                                onClick={() => handleCreateCheckout('price_1S6cOBRyVxTUItc4K968x9mz')}
                                disabled={isLoading === 'price_1S6cOBRyVxTUItc4K968x9mz'}
                            >
                                {isLoading === 'price_1S6cOBRyVxTUItc4K968x9mz' && <Loader2 className="animate-spin" />}
                                Choose Monthly
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
                                <span className="text-5xl font-bold font-code">$99</span>
                                <span className="text-muted-foreground self-end">/ year</span>
                            </div>
                            <p className="text-sm text-muted-foreground">Equivalent to $8.25/month</p>
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
                             <Button 
                                className="w-full" 
                                onClick={() => handleCreateCheckout('price_1S6cOyRyVxTUItc43HaCVot0')}
                                disabled={isLoading === 'price_1S6cOyRyVxTUItc43HaCVot0'}
                            >
                                {isLoading === 'price_1S6cOyRyVxTUItc43HaCVot0' && <Loader2 className="animate-spin" />}
                                Choose Yearly
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-8">
                You will be redirected to Stripe to complete your purchase.
            </p>
        </div>
    );
}

export default function PricingPage() {
    return <ProductDisplay />;
}
