

"use client"

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar"
import { MainNav } from "@/components/main-nav";
import { UserNav } from "@/components/user-nav";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { NewTransactionSheet } from "@/components/new-transaction-sheet";
import { PlusCircle, Download } from "lucide-react";
import { ImportTransactionsDialog } from "@/components/import-transactions-dialog";
import { UserDataProvider, useUserData } from "@/hooks/use-user-data";
import { AdSenseScript } from "@/components/adsense-script";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { AdBanner } from "@/components/ad-banner";
import { cn } from "@/lib/utils";
import { YearSwitcher } from "@/components/year-switcher";
import { ComparisonProvider } from "@/hooks/use-comparison";
import { ComparisonSwitcher } from "@/components/comparison-switcher";
import { LedgerlyBrand } from "@/components/icons";


function AppLayoutSkeleton() {
    return (
        <div className="flex min-h-screen">
            <div className="hidden md:flex flex-col w-64 border-r">
                <div className="p-4">
                    <Skeleton className="h-8 w-32" />
                </div>
                <div className="p-4 space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </div>
            </div>
            <div className="flex-1">
                <header className="flex h-16 items-center border-b px-6">
                    <Skeleton className="h-8 w-32" />
                    <div className="ml-auto flex items-center gap-4">
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                </header>
                <main className="p-6">
                    <Skeleton className="h-64 w-full" />
                </main>
            </div>
        </div>
    )
}

function MainAppShell({ children }: { children: React.ReactNode }) {
    const { addTransaction, importTransactions, categories } = useUserData();
    const { user, activeYear } = useAuth();
    const [isImportSheetOpen, setIsImportSheetOpen] = useState(false);
    const [isNewTxSheetOpen, setIsNewTxSheetOpen] = useState(false);
    
    const systemYear = new Date().getFullYear();
    const isReadOnly = activeYear < systemYear;

    useEffect(() => {
        const url = new URL(window.location.href);
        if (url.searchParams.get('import') !== '1') return;
        setIsImportSheetOpen(true);
        url.searchParams.delete('import');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }, []);

    const showAds = user?.uid !== process.env.NEXT_PUBLIC_ADSENSE_EXCLUDE_UID;
    
    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarHeader>
                    <LedgerlyBrand inverse stacked className="px-2 py-3" markClassName="h-9 w-9" />
                </SidebarHeader>
                <SidebarContent>
                    <MainNav />
                </SidebarContent>
                <SidebarFooter>
                    {/* Optional Footer Content */}
                </SidebarFooter>
            </Sidebar>

            <SidebarInset className="flex flex-col">
                 <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b bg-card/90 px-4 shadow-sm shadow-foreground/[0.03] backdrop-blur-xl">
                    <SidebarTrigger />
                    <YearSwitcher />
                    <div className="hidden md:block">
                        <ComparisonSwitcher />
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        <ImportTransactionsDialog
                            isOpen={isImportSheetOpen}
                            onOpenChange={setIsImportSheetOpen}
                            onTransactionsImported={importTransactions}
                        >
                            <Button variant="outline" size="sm" disabled={isReadOnly} title={isReadOnly ? "You cannot import transactions into a past year." : "Import transactions"} className="flex items-center">
                                <Download className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Import</span>
                            </Button>
                        </ImportTransactionsDialog>

                        <NewTransactionSheet 
                            isOpen={isNewTxSheetOpen} 
                            onOpenChange={setIsNewTxSheetOpen} 
                            onTransactionCreated={(values) => {
                                addTransaction({...values, date: values.date.toISOString()});
                            }} 
                            categories={categories}
                        >
                            <Button size="sm" disabled={isReadOnly} title={isReadOnly ? "You cannot add transactions to a past year." : "Add new transaction"} className="flex items-center">
                                <PlusCircle className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">New</span>
                            </Button>
                        </NewTransactionSheet>
                        <UserNav />
                    </div>
                </header>
                <div className={cn("flex-1", showAds && "pb-[90px]")}>
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 xl:p-10">
                        {children}
                    </main>
                </div>
                 {showAds && (
                    <footer className="fixed bottom-0 right-0 z-10 w-full md:w-[calc(100%-16rem)] peer-data-[collapsible=icon]:w-[calc(100%-3rem)] transition-[width]">
                        <AdBanner showAds={showAds} slot="9876543210" className="mx-auto" />
                    </footer>
                )}
            </SidebarInset>
        </SidebarProvider>
    )
}


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, onboardingComplete } = useAuth();
  
  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    }
     if (!loading && user && !onboardingComplete) {
       router.push('/welcome');
    }
  }, [user, loading, router, onboardingComplete]);
  
  if (loading || !user || !onboardingComplete) {
    return <AppLayoutSkeleton />;
  }
  
  const showAds = user?.uid !== process.env.NEXT_PUBLIC_ADSENSE_EXCLUDE_UID;

  return (
      <UserDataProvider>
        <ComparisonProvider>
            <AdSenseScript showAds={showAds} />
            <MainAppShell>
                {children}
            </MainAppShell>
        </ComparisonProvider>
      </UserDataProvider>
  )
}
