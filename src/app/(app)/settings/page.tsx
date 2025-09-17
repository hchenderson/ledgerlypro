
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { updateProfile } from 'firebase/auth';
import { useUserData } from '@/hooks/use-user-data';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
    const { toast } = useToast();
    const { user, showInstructions, setShowInstructions } = useAuth();
    const { clearTransactions, clearAllData, clearTransactionsByDateRange } = useUserData();
    const [name, setName] = useState('');
    const [startingBalance, setStartingBalance] = useState('');
    const [email, setEmail] = useState('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

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

    const handleClearTransactionsByDate = async () => {
        if (!dateRange?.from || !dateRange?.to) {
            toast({
                variant: "destructive",
                title: "Date Range Required",
                description: "Please select a start and end date.",
            });
            return;
        }
        await clearTransactionsByDateRange(dateRange.from, dateRange.to);
        toast({
            title: "Transactions Cleared",
            description: `Transactions between ${format(dateRange.from, "PPP")} and ${format(dateRange.to, "PPP")} have been deleted.`,
        });
        setDateRange(undefined);
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
                     <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="show-instructions" className="text-base">Show Instructions</Label>
                            <p className="text-sm text-muted-foreground">
                                Display the "Getting Started" guide on your dashboard.
                            </p>
                        </div>
                        <Switch
                            id="show-instructions"
                            checked={showInstructions}
                            onCheckedChange={setShowInstructions}
                        />
                    </div>
                </CardContent>
                </Card>
                <Card>
                <CardHeader>
                    <CardTitle>Danger Zone</CardTitle>
                    <CardDescription>These actions are permanent and cannot be undone.</CardDescription>
                </CardHeader>
                 <CardContent className="space-y-4">
                     <div className="flex flex-col gap-4 rounded-lg border border-destructive/50 p-4">
                        <div>
                            <p className="font-medium">Clear Transactions by Date Range</p>
                            <p className="text-sm text-muted-foreground">Permanently delete all transactions within a specific period.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                             <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    id="date"
                                    variant={"outline"}
                                    className={cn(
                                    "w-full sm:w-[300px] justify-start text-left font-normal",
                                    !dateRange && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                    dateRange.to ? (
                                        <>
                                        {format(dateRange.from, "LLL dd, y")} -{" "}
                                        {format(dateRange.to, "LLL dd, y")}
                                        </>
                                    ) : (
                                        format(dateRange.from, "LLL dd, y")
                                    )
                                    ) : (
                                    <span>Pick a date range</span>
                                    )}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={2}
                                />
                                </PopoverContent>
                            </Popover>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" outline disabled={!dateRange?.from || !dateRange?.to}>Clear Period</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action will permanently delete all transactions between <strong>{dateRange?.from ? format(dateRange.from, "PPP") : ''}</strong> and <strong>{dateRange?.to ? format(dateRange.to, "PPP") : ''}</strong>. This cannot be undone.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleClearTransactionsByDate} className="bg-red-600 hover:bg-red-700">
                                        Yes, delete transactions
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
                        <div>
                            <p className="font-medium">Clear All Transaction Data</p>
                            <p className="text-sm text-muted-foreground">Permanently delete all transactions, leaving your categories intact.</p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" outline>Clear All Transactions</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete all of your transaction data.
                              </AlertDialogDescription>
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
