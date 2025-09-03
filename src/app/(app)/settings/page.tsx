
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
    const { toast } = useToast();
    const [startingBalance, setStartingBalance] = useState('');

    useEffect(() => {
        const storedBalance = localStorage.getItem('startingBalance');
        if (storedBalance) {
            setStartingBalance(storedBalance);
        }
    }, []);

    const handleSaveStartingBalance = () => {
        const balance = parseFloat(startingBalance);
        if (!isNaN(balance)) {
            localStorage.setItem('startingBalance', balance.toString());
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
                        <Input id="name" defaultValue="Ledgerly User" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" defaultValue="user@example.com" />
                    </div>
                </CardContent>
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
                            <Button onClick={handleSaveStartingBalance}>Save</Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Set your initial account balance. This will be used as the baseline for your dashboard calculations.
                        </p>
                    </div>
                </CardContent>
                <CardHeader>
                    <CardTitle>Subscription</CardTitle>
                    <CardDescription>Manage your billing and subscription.</CardDescription>
                </CardHeader>
                 <CardContent className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                        <p className="font-medium">You are on the <span className="text-primary font-bold">Yearly</span> plan.</p>
                        <p className="text-sm text-muted-foreground">Your plan renews on July 20, 2025.</p>
                    </div>
                     <Button variant="outline">Manage Billing</Button>
                </CardContent>
                <CardHeader>
                    <CardTitle>Danger Zone</CardTitle>
                    <CardDescription>These actions are permanent and cannot be undone.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
                     <div>
                        <p className="font-medium">Delete Account</p>
                        <p className="text-sm text-muted-foreground">Permanently delete your account and all associated data.</p>
                    </div>
                    <Button variant="destructive">Delete Account</Button>
                </CardContent>
            </Card>

        </div>
    )
}
