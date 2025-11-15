
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
import { LedgerlyLogo } from "@/components/icons";
import { MainNav } from "@/components/main-nav";
import { UserNav } from "@/components/user-nav";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { NewTransactionSheet } from "@/components/new-transaction-sheet";
import { PlusCircle, Download } from "lucide-react";
import { ImportTransactionsDialog } from "@/components/import-transactions-dialog";
import { UserDataProvider, useUserData } from "@/hooks/use-user-data";
import type { Transaction } from "@/types";
import { AdSenseScript } from "@/components/adsense-script";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { AdBanner } from "@/components/ad-banner";
import { cn } from "@/lib/utils";


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
    const { addTransaction, categories } = useUserData();
    const { user } = useAuth();
    const [isImportSheetOpen, setIsImportSheetOpen] = useState(false);
    const [isNewTxSheetOpen, setIsNewTxSheetOpen] = useState(false);

    const handleTransactionsImported = (transactions: Omit<Transaction, 'id'>[]) => {
        transactions.forEach(addTransaction);
    }

    const showAds = user?.uid !== process.env.NEXT_PUBLIC_ADSENSE_EXCLUDE_UID;
    
    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarHeader>
                    <div className="flex items-center gap-2 p-2">
                        <LedgerlyLogo className="h-8 w-8" />
                        <span className="text-lg font-semibold text-sidebar-primary">Ledgerly Pro</span>
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    <MainNav />
                </SidebarContent>
                <SidebarFooter>
                    {/* Optional Footer Content */}
                </SidebarFooter>
            </Sidebar>

            <SidebarInset className="flex flex-col">
                 <header className="flex h-16 shrink-0 items-center border-b px-6 gap-4">
                    <SidebarTrigger className="md:hidden" />
                    <div className="hidden md:block text-muted-foreground font-medium">
                        Welcome back!
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        <ImportTransactionsDialog
                            isOpen={isImportSheetOpen}
                            onOpenChange={setIsImportSheetOpen}
                            onTransactionsImported={handleTransactionsImported}
                        >
                            <Button variant="outline" size="sm">
                                <Download className="mr-2 h-4 w-4"/>
                                Import
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
                            <Button size="sm">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                New Transaction
                            </Button>
                        </NewTransactionSheet>
                        <UserNav />
                    </div>
                </header>
                <div className={cn("flex-1", showAds && "pb-[90px]")}>
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
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
        <AdSenseScript showAds={showAds} />
        <MainAppShell>
            {children}
        </MainAppShell>
      </UserDataProvider>
  )
}
