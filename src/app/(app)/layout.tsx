
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
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { NewTransactionSheet } from "@/components/new-transaction-sheet";
import { PlusCircle, Download } from "lucide-react";
import { ImportTransactionsDialog } from "@/components/import-transactions-dialog";
import { UserDataProvider, useUserData } from "@/hooks/use-user-data";
import type { Transaction } from "@/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AdSenseScript } from "@/components/adsense-script";


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
  
  const showAds = user?.uid !== process.env.ADSENSE_EXCLUDE_UID;

  return (
      <UserDataProvider>
        <AdSenseScript showAds={showAds} />
        {children}
      </UserDataProvider>
  )
}
