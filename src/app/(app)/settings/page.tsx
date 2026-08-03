
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { updateProfile } from 'firebase/auth';
import { useCategories } from '@/hooks/use-categories';
import { useSettingsData } from '@/hooks/use-settings-data';
import { useAccounts } from '@/hooks/use-accounts';
import {
    useAllTransactions,
    useTransactionData,
} from '@/hooks/use-transactions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from '@/components/ui/switch';
import { CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { SearchableMultiSelect } from '@/components/ui/searchable-multi-select';
import { normalizeMerchant } from '@/forecast/merchant-normalize';
import { useIsMobile } from '@/hooks/use-mobile';
import {
    displayAccountBalance,
    normalizeOpeningBalance,
} from '@/lib/accounts';
import { PlaidConnectionsCard } from '@/components/plaid/plaid-connections-card';

export default function SettingsPage() {
    const { toast } = useToast();
    const { user, showInstructions, setShowInstructions, budgetingMode, setBudgetingMode, envelopeSettings, setEnvelopeSettings, forecastSettings, setForecastSettings } = useAuth();
    const { categories } = useCategories();
    const { clearAllData } = useSettingsData();
    const {
        accounts,
        primaryAccountId,
        updateAccount,
    } = useAccounts();
    const primaryAccount = accounts.find(
        (account) => account.id === primaryAccountId,
    );
    const savedStartingBalance = primaryAccount
        ? displayAccountBalance(
            primaryAccount,
            primaryAccount.openingBalance,
        )
        : 0;
    const {
        clearTransactions,
        clearTransactionsByDateRange,
    } = useTransactionData();
    const { transactions: allTransactions } = useAllTransactions();
    const [name, setName] = useState('');
    const [startingBalance, setStartingBalance] = useState('');
    const [email, setEmail] = useState('');
    const [minimumOperatingBalance, setMinimumOperatingBalance] = useState('0');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const isMobile = useIsMobile();

    useEffect(() => {
        if (user) {
            setName(user.displayName || '');
            setEmail(user.email || '');
        }
    }, [user]);

    useEffect(() => {
        setStartingBalance(savedStartingBalance.toString());
    }, [savedStartingBalance]);

    useEffect(() => {
        setMinimumOperatingBalance(envelopeSettings.minimumOperatingBalance.toString());
    }, [envelopeSettings.minimumOperatingBalance]);

    const handleSaveProfile = async () => {
        if (user) {
            try {
                await updateProfile(user, { displayName: name });
                toast({
                    title: "Profile Saved",
                    description: "Your name has been updated.",
                });
            } catch {
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
            if (!primaryAccountId) return;
            await updateAccount(primaryAccountId, {
                openingBalance: normalizeOpeningBalance(
                    primaryAccount?.type ?? "checking",
                    balance,
                ),
            });
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
            description: "All financial planning data has been reset. Your account list remains available.",
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
    
    const categoryOptions = useMemo(() => {
        const mainCategories = categories.filter(c => c.type === 'expense');
        return mainCategories.map(c => ({ value: c.name, label: c.name }));
    }, [categories]);

    const merchantOptions = useMemo(() => {
        const merchantCounts: Record<string, { key: string, name: string, count: number }> = {};
        allTransactions.forEach(t => {
            if (t.type === 'expense') {
                const { merchantKey, merchantName } = normalizeMerchant(t.description);
                if (merchantKey !== 'unknown') {
                    if (!merchantCounts[merchantKey]) {
                        merchantCounts[merchantKey] = { key: merchantKey, name: merchantName, count: 0 };
                    }
                    merchantCounts[merchantKey].count++;
                }
            }
        });

        return Object.values(merchantCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 50)
            .map(m => ({ value: m.key, label: m.name }));
    }, [allTransactions]);

    const handleExcludedCategoriesChange = (selected: string[]) => {
        setForecastSettings({ baselineExclusions: { categories: selected } });
    }

    const handleExcludedMerchantsChange = (selected: string[]) => {
        setForecastSettings({ baselineExclusions: { merchants: selected } });
    }

    const excludedCategories = forecastSettings?.baselineExclusions?.categories || [];
    const excludedMerchants = forecastSettings?.baselineExclusions?.merchants || [];
    const dateRangeLabel = dateRange?.from
        ? dateRange.to
            ? `${format(dateRange.from, "LLL dd, y")} – ${format(dateRange.to, "LLL dd, y")}`
            : format(dateRange.from, "LLL dd, y")
        : "Pick a date range";

    return (
        <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
            <div>
                <h1 className="font-headline text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your account settings and preferences.
                </p>
            </div>
            
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle>Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" autoComplete="email" value={email} disabled />
                    </div>
                     <Button onClick={handleSaveProfile} className="w-full sm:w-auto">Save Profile</Button>
                </CardContent>
                </Card>
                <Card>
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle>Primary Account</CardTitle>
                    <CardDescription>
                        Update the opening balance for {primaryAccount?.name ?? "your primary account"}.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
                    <div className="space-y-2">
                        <Label htmlFor="starting-balance">
                            {primaryAccount?.classification === "liability"
                                ? "Opening Amount Owed"
                                : "Opening Balance"}
                        </Label>
                        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                            <Input 
                                id="starting-balance" 
                                type="number" 
                                inputMode="decimal"
                                step="0.01"
                                placeholder="0.00" 
                                value={startingBalance}
                                onChange={(e) => setStartingBalance(e.target.value)}
                                aria-describedby="starting-balance-help"
                            />
                            <Button onClick={handleSaveStartingBalance} className="w-full shrink-0 sm:w-auto">Save Balance</Button>
                        </div>
                        <p id="starting-balance-help" className="text-sm text-muted-foreground">
                            This is the balance immediately before the first Ledgerly transaction in this account. Add, rename, or archive accounts on the Accounts page.
                        </p>
                    </div>
                     <div className="flex min-h-16 flex-row items-center justify-between gap-4 rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="show-instructions" className="cursor-pointer text-base">Show Instructions</Label>
                            <p id="show-instructions-help" className="text-sm text-muted-foreground">
                                Display the "Getting Started" guide on your dashboard.
                            </p>
                        </div>
                        <Switch
                            id="show-instructions"
                            checked={showInstructions}
                            onCheckedChange={setShowInstructions}
                            aria-describedby="show-instructions-help"
                        />
                    </div>
                </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle>Budgeting Method</CardTitle>
                        <CardDescription>
                            Choose how Ledgerly helps organize your money. Changing this view never changes transactions or report totals.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 px-4 pb-4 sm:grid-cols-3 sm:px-6 sm:pb-6">
                        {[
                            { value: "tracking" as const, title: "Tracking", description: "Use category spending limits and bookkeeping reports." },
                            { value: "envelope" as const, title: "Envelope", description: "Assign real cash to account-backed purposes." },
                            { value: "hybrid" as const, title: "Hybrid", description: "Use envelopes and category limits together." },
                        ].map((option) => (
                            <button
                                type="button"
                                key={option.value}
                                onClick={() => void setBudgetingMode(option.value)}
                                aria-pressed={budgetingMode === option.value}
                                className={cn(
                                    "rounded-xl border p-4 text-left transition-colors hover:border-primary/50",
                                    budgetingMode === option.value && "border-primary bg-secondary/50 ring-1 ring-primary",
                                )}
                            >
                                <span className="font-semibold">{option.title}</span>
                                <span className="mt-1 block text-sm text-muted-foreground">{option.description}</span>
                            </button>
                        ))}
                        <div className="space-y-2 rounded-xl border p-4 sm:col-span-3">
                            <Label htmlFor="minimum-operating-balance">Minimum Main account cushion</Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Input
                                    id="minimum-operating-balance"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={minimumOperatingBalance}
                                    onChange={(event) => setMinimumOperatingBalance(event.target.value)}
                                />
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        const amount = Math.max(0, Number(minimumOperatingBalance) || 0);
                                        void setEnvelopeSettings({ minimumOperatingBalance: amount });
                                        toast({ title: "Envelope safeguard saved" });
                                    }}
                                >
                                    Save cushion
                                </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">Envelope funding is blocked when it would push the Main account below this amount.</p>
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-xl border p-4 sm:col-span-3">
                            <div>
                                <Label htmlFor="funding-suggestions">Funding suggestions</Label>
                                <p className="text-sm text-muted-foreground">Show recommended envelope transfers after income arrives. Suggestions never move money automatically.</p>
                            </div>
                            <Switch
                                id="funding-suggestions"
                                checked={envelopeSettings.fundingSuggestions}
                                onCheckedChange={(fundingSuggestions) => void setEnvelopeSettings({ fundingSuggestions })}
                            />
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle>Forecast Settings</CardTitle>
                        <CardDescription>Exclude specific categories or merchants from baseline forecasting to improve accuracy for non-recurring expenses.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 px-4 pb-4 sm:px-6 sm:pb-6">
                        <div className="space-y-2">
                            <Label>Exclude Categories</Label>
                            <SearchableMultiSelect
                                options={categoryOptions}
                                selected={excludedCategories}
                                onChange={handleExcludedCategoriesChange}
                                placeholder="Select categories to exclude..."
                                className="min-h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Exclude Merchants</Label>
                            <p className="text-sm text-muted-foreground">
                                Exclude frequent merchants that represent sporadic, non-recurring spending (e.g., a hardware store for a one-off project).
                            </p>
                            <SearchableMultiSelect
                                options={merchantOptions}
                                selected={excludedMerchants}
                                onChange={handleExcludedMerchantsChange}
                                placeholder="Select merchants to exclude..."
                                className="min-h-11"
                            />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle>Danger Zone</CardTitle>
                    <CardDescription>These actions are permanent and cannot be undone.</CardDescription>
                </CardHeader>
                 <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
                     <div className="flex flex-col gap-4 rounded-lg border border-destructive/50 p-4">
                        <div>
                            <p className="font-medium">Clear Transactions by Date Range</p>
                            <p id="clear-period-help" className="text-sm text-muted-foreground">Permanently delete all transactions within a specific period.</p>
                        </div>
                        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                             <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    id="date"
                                    variant={"outline"}
                                    aria-label={`Transaction deletion period: ${dateRangeLabel}`}
                                    aria-describedby="clear-period-help"
                                    className={cn(
                                    "w-full min-w-0 justify-start overflow-hidden text-left font-normal sm:w-[300px]",
                                    !dateRange && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                    <span className="truncate">{dateRangeLabel}</span>
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[calc(100vw-2rem)] max-w-fit overflow-x-auto p-0 sm:w-auto" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={isMobile ? 1 : 2}
                                />
                                </PopoverContent>
                            </Popover>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button className="w-full sm:w-auto" variant="destructive" outline disabled={!dateRange?.from || !dateRange?.to}>Clear Period</Button>
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
                    <div className="flex flex-col items-stretch gap-4 rounded-lg border border-destructive/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-medium">Clear All Transaction Data</p>
                            <p className="text-sm text-muted-foreground">Permanently delete all transactions, leaving your categories intact.</p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button className="w-full shrink-0 sm:w-auto" variant="destructive" outline>Clear All Transactions</Button>
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
                    <div className="flex flex-col items-stretch gap-4 rounded-lg border border-destructive/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-medium">Clear All Data</p>
                            <p className="text-sm text-muted-foreground">Permanently delete transactions, categories, budgets, goals, recurring schedules, envelopes, and reconciliations.</p>
                        </div>
                         <AlertDialog>
                          <AlertDialogTrigger asChild>
                           <Button className="w-full shrink-0 sm:w-auto" variant="destructive">Clear All Data</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. It permanently deletes all financial activity and planning data. Your account list and sign-in remain available.
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

            <PlaidConnectionsCard compact />

        </div>
    )
}
