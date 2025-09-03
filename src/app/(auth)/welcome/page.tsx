
"use client";

import { useState } from 'react';
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


export default function WelcomePage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [startingBalance, setStartingBalance] = useState('');
    const [subscription, setSubscription] = useState('free');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleNext = () => setStep(prev => prev + 1);
    const handleBack = () => setStep(prev => prev - 1);

    const handleFinish = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You are not logged in.' });
            router.push('/signin');
            return;
        }

        if(!name) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter your name.' });
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Update user profile name
            await updateProfile(user, { displayName: name });

            // 2. Save starting balance to localStorage
            const balance = parseFloat(startingBalance);
            if (!isNaN(balance)) {
                localStorage.setItem('startingBalance', balance.toString());
            } else {
                 localStorage.setItem('startingBalance', '0');
            }
            
            // 3. (Optional) Save subscription choice. For now, we'll just log it.
            console.log(`User ${user.uid} chose the ${subscription} plan.`);

            // 4. Mark onboarding as complete
            localStorage.setItem('onboardingComplete', 'true');

            toast({ title: 'Setup Complete!', description: 'Welcome to Ledgerly Pro. Redirecting you to the dashboard...' });
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
                    <CardTitle className="text-center">Welcome to Ledgerly Pro!</CardTitle>
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
                            <h3 className="text-xl font-semibold">What's your starting balance?</h3>
                            <p className="text-muted-foreground">You can change this later in your settings. You can also leave it at 0.</p>
                             <div className="space-y-2 text-left max-w-sm mx-auto">
                                <Label htmlFor="starting-balance">Starting Balance</Label>
                                <Input id="starting-balance" type="number" placeholder="0.00" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} />
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
                                <button onClick={() => setSubscription('monthly')} className={cn("rounded-lg border p-4 text-left transition-all relative", subscription === 'monthly' && 'ring-2 ring-primary border-primary')}>
                                     <h4 className="font-semibold">Pro Monthly</h4>
                                    <p className="text-sm text-muted-foreground">$4.99 / month</p>
                                    <p className="text-xs text-muted-foreground mt-2">All pro features</p>
                                    {subscription === 'monthly' && <Check className="absolute top-2 right-2 h-5 w-5 text-primary" />}
                                </button>
                                <button onClick={() => setSubscription('yearly')} className={cn("rounded-lg border p-4 text-left transition-all relative", subscription === 'yearly' && 'ring-2 ring-primary border-primary')}>
                                    <Sparkles className="absolute top-2 left-2 size-4 text-primary" />
                                    <h4 className="font-semibold">Pro Yearly</h4>
                                    <p className="text-sm text-muted-foreground">$39.99 / year</p>
                                    <p className="text-xs font-bold text-primary">Save 30%</p>
                                    {subscription === 'yearly' && <Check className="absolute top-2 right-2 h-5 w-5 text-primary" />}
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
                        <Button onClick={handleNext}>
                            Next <ArrowRight className="mr-2 h-4 w-4" />
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
