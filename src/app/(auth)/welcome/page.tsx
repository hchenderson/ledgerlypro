
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { User, Wallet, ArrowRight, ArrowLeft, Loader2, FileUp, Sparkles } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { Progress } from '@/components/ui/progress';
import { doc, setDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { defaultTransactions, defaultCategories, defaultBudgets, defaultRecurringTransactions, defaultGoals } from '@/lib/data';
import type { Transaction, Category, Budget, RecurringTransaction, Goal } from '@/types';
import { cn } from '@/lib/utils';
import { LedgerlyBrand } from '@/components/icons';

type SetupMode = 'empty' | 'sample' | 'import';

export default function WelcomePage() {
    const { user, setOnboardingComplete } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [startingBalance, setStartingBalance] = useState('');
    const [setupMode, setSetupMode] = useState<SetupMode>('empty');
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
        
        const collections: { [key: string]: (Omit<Transaction, 'id'> | Omit<Category, 'id'> | Omit<Budget, 'id'> | Omit<RecurringTransaction, 'id'> | Omit<Goal, 'id'>)[] } = {
            transactions: defaultTransactions,
            categories: defaultCategories,
            budgets: defaultBudgets,
            recurringTransactions: defaultRecurringTransactions,
            goals: defaultGoals,
        };
    
        for (const [collectionName, data] of Object.entries(collections)) {
            const collRef = collection(db, 'users', user.uid, collectionName);
            data.forEach((item, index) => {
                const existingId = 'id' in item && typeof item.id === 'string' ? item.id : undefined;
                const documentId = existingId ?? `sample-${collectionName}-${index + 1}`;
                batch.set(doc(collRef, documentId), { ...item, id: documentId });
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

            const balance = parseFloat(startingBalance);
            await setDoc(settingsRef, {
                startingBalance: isNaN(balance) ? 0 : balance,
            }, { merge: true });
            
            if (setupMode === 'sample') {
                await seedDefaultData();
            }

            await setDoc(settingsRef, {
                onboardingComplete: true,
                dataSchemaVersion: 2,
            }, { merge: true });
            await setOnboardingComplete(true);

            toast({
                title: 'Setup complete!',
                description: setupMode === 'import'
                    ? 'Your account is ready. Choose your CSV file next.'
                    : 'Welcome to Ledgerly Pro.',
            });
            router.push(setupMode === 'import' ? '/transactions?import=1' : '/dashboard');

        } catch (error) {
            console.error('Onboarding failed:', error);
            toast({ variant: 'destructive', title: 'Onboarding Failed', description: 'An error occurred. Please try again.' });
            setIsSubmitting(false);
        }
    };
    
    const progress = (step / 2) * 100;

    return (
        <main className="brand-grid flex min-h-dvh items-start justify-center overflow-y-auto bg-brand-mint px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:items-center md:p-8">
          <div className="my-auto w-full max-w-2xl">
            <LedgerlyBrand className="mx-auto mb-5 sm:mb-7" />
            <Card className="w-full border-primary/10 shadow-[0_28px_70px_-40px_rgba(41,58,94,0.5)]">
                <CardHeader className="p-4 sm:p-6">
                    <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-primary">Account setup</p>
                    <CardTitle className="text-center text-xl text-brand-navy dark:text-white sm:text-2xl">Build your financial foundation</CardTitle>
                    <CardDescription className="text-center">Two quick steps, then your workspace is ready.</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-5 sm:px-6 sm:pb-6">
                    <Progress
                        value={progress}
                        className="mb-6 motion-reduce:[&>div]:transition-none sm:mb-8"
                        aria-label={`Setup progress: step ${step} of 2`}
                        aria-valuetext={`Step ${step} of 2`}
                    />
                    {step === 1 && (
                        <div className="animate-in space-y-4 text-center fade-in-0 duration-500 motion-reduce:animate-none">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <User className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-semibold">What should we call you?</h3>
                            <p className="text-muted-foreground">This will be used to personalize your experience.</p>
                             <div className="mx-auto max-w-sm space-y-2 text-left">
                                <Label htmlFor="name">Full Name</Label>
                                <Input
                                    id="name"
                                    autoComplete="name"
                                    enterKeyHint="next"
                                    placeholder="e.g. Jane Doe"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                    {step === 2 && (
                         <div className="animate-in space-y-4 text-center fade-in-0 duration-500 motion-reduce:animate-none">
                             <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Wallet className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-semibold">Set up your account</h3>
                            <p className="text-muted-foreground">You can change these settings later.</p>
                             <div className="mx-auto max-w-sm space-y-4 text-left">
                                <div className="space-y-2">
                                    <Label htmlFor="starting-balance">Starting Balance (Optional)</Label>
                                    <Input
                                        id="starting-balance"
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={startingBalance}
                                        onChange={(e) => setStartingBalance(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2" role="radiogroup" aria-label="How to begin">
                                    {([
                                        { value: 'empty', title: 'Start clean', description: 'Begin with an empty account and add your own data.', icon: Wallet },
                                        { value: 'import', title: 'Import a CSV', description: 'Finish setup, then open the guided transaction importer.', icon: FileUp },
                                        { value: 'sample', title: 'Explore sample data', description: 'Add clearly marked example transactions, budgets, and goals.', icon: Sparkles },
                                    ] as const).map((option) => {
                                        const Icon = option.icon;
                                        const selected = setupMode === option.value;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={selected}
                                                onClick={() => setSetupMode(option.value)}
                                                className={cn(
                                                    'flex min-h-11 w-full touch-manipulation items-start gap-3 rounded-xl border p-3.5 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none',
                                                    selected ? 'border-primary bg-secondary/45 shadow-sm' : 'hover:border-primary/25 hover:bg-muted/50'
                                                )}
                                            >
                                                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                                                <span>
                                                    <span className="block text-sm font-medium">{option.title}</span>
                                                    <span className="block text-sm text-muted-foreground">{option.description}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="sticky bottom-0 z-10 grid grid-cols-2 gap-3 rounded-b-xl border-t bg-card/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-6 sm:pt-4">
                    <Button type="button" variant="outline" onClick={handleBack} disabled={step === 1 || isSubmitting}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    {step < 2 ? (
                        <Button type="button" onClick={handleNext} disabled={!name && step === 1}>
                            Next <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button type="button" onClick={handleFinish} disabled={isSubmitting} aria-busy={isSubmitting}>
                             {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}
                            Finish Setup
                        </Button>
                    )}
                    <span className="sr-only" role="status" aria-live="polite">
                        {isSubmitting ? "Finishing account setup" : ""}
                    </span>
                </CardFooter>
            </Card>
          </div>
        </main>
    );
}
