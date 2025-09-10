
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Check, User, Wallet, CreditCard, ArrowRight, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { doc, setDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { defaultTransactions, defaultCategories, defaultBudgets, defaultRecurringTransactions, defaultGoals } from '@/lib/data';
import type { Transaction, Category, Budget, RecurringTransaction, Goal } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';


export default function WelcomePage() {
    const { user, setPlan, setOnboardingComplete } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [startingBalance, setStartingBalance] = useState('');
    const [subscription, setSubscription] = useState<'free' | 'pro'>('free');
    const [seedData, setSeedData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if(user?.displayName) {
            setName(user.displayName);
        }
    }, [user])

    const handleNext = () => setStep(prev => prev + 1);
    const handleBack = () => setStep(prev => prev - 1);
    
    const seedDefaultData = async () => {
        if (!user) return;
        const batch = writeBatch(db);
        
        const collections: { [key: string]: any[] } = {
            transactions: defaultTransactions,
            categories: defaultCategories,
            budgets: defaultBudgets,
            recurringTransactions: defaultRecurringTransactions,
            goals: defaultGoals,
        };
    
        for (const [name, data] of Object.entries(collections)) {
            const collRef = collection(db, 'users', user.uid, name);
            data.forEach((item) => {
                const docRef = doc(collRef);
                const { ...serializableItem } = item;
                batch.set(docRef, { ...serializableItem, id: docRef.id });
            });
        }
    
        await batch.commit();
    };

    const handleFinish = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You are not logged in.' });
            router.push('/signin');
            return;
        }

        if(!name) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter your name.' });
            setStep(1);
            return;
        }

        setIsSubmitting(true);
        try {
            await updateProfile(user, { displayName: name });
            
            const settingsRef = doc(db, 'users', user.uid, 'settings', 'main');
            
            await setPlan(subscription);

            const balance = parseFloat(startingBalance);
             await setDoc(settingsRef, { 
                startingBalance: isNaN(balance) ? 0 : balance,
                onboardingComplete: true
            }, { merge: true });
            
            if (seedData) {
                await seedDefaultData();
            }
            
            await setOnboardingComplete(true);

            toast({ title: 'Setup Complete!', description: 'Welcome to Ledgerly. Redirecting you to the dashboard...' });
            router.push('/dashboard');

        } catch (error) {
            console.error('Onboarding failed:', error);
            toast({ variant: 'destructive', title: 'Onboarding Failed', description: 'An error occurred. Please try again.' });
            setIsSubmitting(false);
        }
    };
    
    const progress = (step / 3) * 100;

    return (
        <div className="flex min-h-screen items-center justify-center bg-secondary/50 p-4">
            <Card className="w-full max-w-2xl">
                <CardHeader>
                    <CardTitle className="text-center">Welcome to Ledgerly!</CardTitle>
                    <CardDescription className="text-center">Let's get your account set up in a few steps.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Progress value={progress} className="mb-8" />
                    {step === 1 && (
                        <div className="space-y-4 text-center animate-in fade-in-0 duration-500">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <User className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-semibold">What should we call you?</h3>
                            <p className="text-muted-foreground">This will be used to personalize your experience.</p>
                             <div className="space-y-2 text-left max-w-sm mx-auto">
                                <Label htmlFor="name">Full Name</Label>
                                <Input id="name" placeholder="e.g. Jane Doe" value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                        </div>
                    )}
                    {step === 2 && (
                         <div className="space-y-4 text-center animate-in fade-in-0 duration-500">
                             <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Wallet className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-semibold">Set up your account</h3>
                            <p className="text-muted-foreground">You can change these settings later.</p>
                             <div className="space-y-4 text-left max-w-sm mx-auto">
                                <div className="space-y-2">
                                    <Label htmlFor="starting-balance">Starting Balance (Optional)</Label>
                                    <Input id="starting-balance" type="number" placeholder="0.00" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} />
                                </div>
                                <div className="flex items-center space-x-2 rounded-md border p-4">
                                    <Checkbox id="seed-data" checked={seedData} onCheckedChange={(checked) => setSeedData(!!checked)}/>
                                    <div className="grid gap-1.5 leading-none">
                                        <label
                                        htmlFor="seed-data"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                        Add sample data
                                        </label>
                                        <p className="text-sm text-muted-foreground">
                                        Populate your account with sample transactions and categories to explore features.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {step === 3 && (
                        <div className="space-y-4 text-center animate-in fade-in-0 duration-500">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <CreditCard className="h-6 w-6" />
                            </div>
                             <h3 className="text-xl font-semibold">Choose your plan</h3>
                             <p className="text-muted-foreground">You can always upgrade or downgrade later.</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                <button onClick={() => setSubscription('free')} className={cn("rounded-lg border p-4 text-left transition-all relative", subscription === 'free' && 'ring-2 ring-primary border-primary')}>
                                    <h4 className="font-semibold">Free</h4>
                                    <p className="text-sm text-muted-foreground">$0 / month</p>
                                    <p className="text-xs text-muted-foreground mt-2">Basic features</p>
                                    {subscription === 'free' && <Check className="absolute top-2 right-2 h-5 w-5 text-primary" />}
                                </button>
                                <button onClick={() => setSubscription('pro')} className={cn("rounded-lg border p-4 text-left transition-all relative", subscription === 'pro' && 'ring-2 ring-primary border-primary')}>
                                     <h4 className="font-semibold">Pro</h4>
                                    <p className="text-sm text-muted-foreground">$4.99 / month</p>
                                    <p className="text-xs text-muted-foreground mt-2">All pro features</p>
                                    {subscription === 'pro' && <Check className="absolute top-2 right-2 h-5 w-5 text-primary" />}
                                </button>
                                 <button onClick={() => setSubscription('pro')} className={cn("rounded-lg border p-4 text-left transition-all relative", subscription === 'pro' && 'ring-2 ring-primary border-primary')}>
                                    <Sparkles className="absolute top-2 left-2 size-4 text-primary" />
                                    <h4 className="font-semibold">Pro Yearly</h4>
                                    <p className="text-sm text-muted-foreground">$39.99 / year</p>
                                    <p className="text-xs font-bold text-primary">Save 30%</p>
                                    {subscription === 'pro' && <Check className="absolute top-2 right-2 h-5 w-5 text-primary" />}
                                </button>
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={handleBack} disabled={step === 1 || isSubmitting}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    {step < 3 ? (
                        <Button onClick={handleNext} disabled={!name && step === 1}>
                            Next <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button onClick={handleFinish} disabled={isSubmitting}>
                             {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Finish Setup
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
