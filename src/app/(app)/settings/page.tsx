
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { updateProfile } from 'firebase/auth';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useUserData } from '@/hooks/use-user-data';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function SettingsPage() {
    const { toast } = useToast();
    const { user, plan } = useAuth();
    const { clearTransactions, clearAllData } = useUserData();
    const [name, setName] = useState('');
    const [startingBalance, setStartingBalance] = useState('');
    const [email, setEmail] = useState('');

    useEffect(() => {
        if (user) {
            setName(user.displayName || '');
            setEmail(user.email || '');
            
            const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'main');
            getDoc(settingsDocRef).then(docSnap => {
                if (docSnap.exists()) {
                    setStartingBalance(docSnap.data().startingBalance?.toString() || '0');
                }
            })
        }
    }, [user]);

    const handleSaveProfile = async () => {
        if (user) {
            try {
                await updateProfile(user, { displayName: name });
                toast({
                    title: "Profile Saved",
                    description: "Your name has been updated.",
                });
            } catch (error) {
                 toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Could not update your name.",
                });
            }
        }
    };
    
    const handleSaveStartingBalance = async () => {
        if (!user) return;
        const balance = parseFloat(startingBalance);
        if (!isNaN(balance)) {
             const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'main');
             await setDoc(settingsDocRef, { startingBalance: balance }, { merge: true });
            toast({
                title: "Settings Saved",
                description: "Your starting balance has been updated.",
            });
        } else {
            toast({
                variant: "destructive",
                title: "Invalid Input",
                description: "Please enter a valid number for the starting balance.",
            });
        }
    };

    const handleClearTransactions = async () => {
        await clearTransactions();
        toast({
            title: "Transactions Cleared",
            description: "All transaction data has been successfully deleted.",
        });
    }
    
    const handleClearAllData = async () => {
        await clearAllData();
        toast({
            title: "All Data Cleared",
            description: "All transaction and category data has been reset.",
        });
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h2 className="text-2xl font-bold tracking-tight font-headline">Settings</h2>
                <p className="text-muted-foreground">
                    Manage your account settings and preferences.
                </p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                    <CardDescription>This is how others will see you on the site.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={email} disabled />
                    </div>
                     <Button onClick={handleSaveProfile}>Save Profile</Button>
                </CardContent>
                </Card>
                <Card>
                <CardHeader>
                    <CardTitle>Account</CardTitle>
                    <CardDescription>Manage your account settings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="starting-balance">Starting Balance</Label>
                        <div className="flex items-center gap-2">
                            <Input 
                                id="starting-balance" 
                                type="number" 
                                placeholder="0.00" 
                                value={startingBalance}
                                onChange={(e) => setStartingBalance(e.target.value)}
                            />
                            <Button onClick={handleSaveStartingBalance}>Save Balance</Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Set your initial account balance. This will be used as the baseline for your dashboard calculations.
                        </p>
                    </div>
                </CardContent>
                </Card>
                <Card>
                <CardHeader>
                    <CardTitle>Subscription</CardTitle>
                    <CardDescription>Manage your billing and subscription.</CardDescription>
                </CardHeader>
                 <CardContent className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                        <div className="font-medium">You are on the <Badge variant={plan === 'pro' ? 'default' : 'secondary'} className="font-bold capitalize">{plan}</Badge> plan.</div>
                        <p className="text-sm text-muted-foreground">
                            {plan === 'pro' ? 'You have access to all features.' : 'Limited to 100 transactions.'}
                        </p>
                    </div>
                     <Button asChild>
                        <Link href="/pricing">{plan === 'pro' ? 'Manage Plan' : 'Upgrade Plan'}</Link>
                     </Button>
                </CardContent>
                </Card>
                <Card>
                <CardHeader>
                    <CardTitle>Danger Zone</CardTitle>
                    <CardDescription>These actions are permanent and cannot be undone.</CardDescription>
                </CardHeader>
                 <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
                        <div>
                            <p className="font-medium">Clear All Transaction Data</p>
                            <p className="text-sm text-muted-foreground">Permanently delete all transactions, leaving your categories intact.</p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" outline>Clear Transactions</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete all of your transaction data.
                              </Description>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleClearTransactions} className="bg-red-600 hover:bg-red-700">
                                Yes, delete transactions
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
                        <div>
                            <p className="font-medium">Clear All Data</p>
                            <p className="text-sm text-muted-foreground">Permanently delete all transactions and categories.</p>
                        </div>
                         <AlertDialog>
                          <AlertDialogTrigger asChild>
                           <Button variant="destructive">Clear All Data</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete all of your transaction and category data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleClearAllData} className="bg-red-600 hover:bg-red-700">
                                Yes, delete all data
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </div>
                 </CardContent>
            </Card>

        </div>
    )
}
