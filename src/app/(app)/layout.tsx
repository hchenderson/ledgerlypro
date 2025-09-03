
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
import { LedgerlyProLogo } from "@/components/icons";
import { MainNav } from "@/components/main-nav";
import { UserNav } from "@/components/user-nav";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { NewTransactionSheet } from "@/components/new-transaction-sheet";
import { PlusCircle, LogIn } from "lucide-react";
import { ImportTransactionsDialog } from "@/components/import-transactions-dialog";

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
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);


  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    }
  }, [user, loading, router]);


  const getPageTitle = () => {
    const segment = pathname.split('/').pop();
    if (!segment || segment === 'dashboard') return 'Dashboard';
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  };
  
  if (loading || !user) {
    return <AppLayoutSkeleton />;
  }
  
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link href="/dashboard" className="flex items-center gap-2" prefetch={false}>
            <LedgerlyProLogo className="size-8 text-sidebar-primary" />
            <span className="font-headline text-lg font-semibold text-sidebar-primary">
              Ledgerly Pro
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <MainNav />
        </SidebarContent>
        <SidebarFooter>
          <Button asChild className="w-full" variant="secondary">
            <Link href="/pricing">Upgrade to Pro</Link>
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="md:hidden" />
                <h1 className="font-headline text-xl font-semibold">{getPageTitle()}</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
                 <ImportTransactionsDialog
                    isOpen={isImportDialogOpen}
                    onOpenChange={setIsImportDialogOpen}
                    onTransactionsImported={(transactions) => console.log('imported', transactions)}
                  >
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => setIsImportDialogOpen(true)}>
                      <LogIn className="size-4" />
                      <span className="hidden sm:inline">Import</span>
                    </Button>
                  </ImportTransactionsDialog>
                 <NewTransactionSheet 
                    isOpen={isSheetOpen}
                    onOpenChange={setIsSheetOpen}
                    onTransactionCreated={(values) => console.log(values)}
                  >
                     <Button size="sm" className="gap-2" onClick={() => setIsSheetOpen(true)}>
                        <PlusCircle className="size-4"/>
                        <span className="hidden sm:inline">New Transaction</span>
                    </Button>
                </NewTransactionSheet>
                <UserNav />
            </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
