
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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


const ProductDisplay = () => (
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
                    <Button className="w-full" variant="outline">Current Plan</Button>
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
                    <form action="/create-checkout-session" method="POST" className="w-full">
                        <input type="hidden" name="lookup_key" value="ledgerly_pro_monthly" />
                        <Button className="w-full" variant="outline" type="submit">Choose Monthly</Button>
                    </form>
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
                     <form action="/create-checkout-session" method="POST" className="w-full">
                        <input type="hidden" name="lookup_key" value="ledgerly_pro_yearly" />
                        <Button className="w-full" type="submit">Choose Yearly</Button>
                    </form>
                </CardFooter>
            </Card>
        </div>
            <p className="text-center text-sm text-muted-foreground mt-8">
            You can upgrade, downgrade, or cancel at any time.
        </p>
    </div>
);

const SuccessDisplay = ({ sessionId }: { sessionId: string }) => {
  return (
    <section className="text-center">
        <Card className="max-w-md mx-auto">
            <CardHeader>
                <CardTitle>Subscription successful!</CardTitle>
                <CardDescription>Welcome to Ledgerly Pro. You now have access to all features.</CardDescription>
            </CardHeader>
            <CardContent>
                 <form action="/create-portal-session" method="POST">
                    <input
                    type="hidden"
                    id="session-id"
                    name="session_id"
                    value={sessionId}
                    />
                    <Button type="submit">
                        Manage your billing information
                    </Button>
                </form>
            </CardContent>
        </Card>
    </section>
  );
};

const Message = ({ message }: { message: string }) => (
    <section className="text-center">
        <Card className="max-w-md mx-auto">
            <CardHeader>
                <CardTitle>Order Canceled</CardTitle>
            </CardHeader>
            <CardContent>
                 <p>{message}</p>
            </CardContent>
        </Card>
    </section>
);


export default function PricingPage() {
    let [message, setMessage] = useState('');
    let [success, setSuccess] = useState(false);
    let [sessionId, setSessionId] = useState('');

    useEffect(() => {
        const query = new URLSearchParams(window.location.search);

        if (query.get('success')) {
        setSuccess(true);
        setSessionId(query.get('session_id') || '');
        }

        if (query.get('canceled')) {
        setSuccess(false);
        setMessage(
            "Order canceled -- you can continue to browse and checkout when you're ready."
        );
        }
    }, [sessionId]);

    if (!success && message === '') {
        return <ProductDisplay />;
    } else if (success && sessionId !== '') {
        return <SuccessDisplay sessionId={sessionId} />;
    } else {
        return <Message message={message} />;
    }
}
