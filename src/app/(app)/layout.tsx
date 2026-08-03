

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
import { PlusCircle, Download, MoreHorizontal, ArrowRightLeft } from "lucide-react";
import { UserDataProvider } from "@/hooks/use-user-data";
import { useCategories } from "@/hooks/use-categories";
import { AccountsProvider, useAccounts } from "@/hooks/use-accounts";
import { TransactionDataProvider, useTransactionData } from "@/hooks/use-transactions";
import { AdSenseScript } from "@/components/adsense-script";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { AdBanner } from "@/components/ad-banner";
import { cn } from "@/lib/utils";
import { YearSwitcher } from "@/components/year-switcher";
import { ComparisonProvider } from "@/hooks/use-comparison";
import { ComparisonSwitcher } from "@/components/comparison-switcher";
import { LedgerlyBrand } from "@/components/icons";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import dynamic from "next/dynamic";
import { AppProviders } from "@/app/providers";
import { AccountSwitcher } from "@/components/account-switcher";
import { useToast } from "@/hooks/use-toast";
import { EnvelopesProvider } from "@/hooks/use-envelopes";

const NewTransactionSheet = dynamic(
    () =>
        import("@/components/new-transaction-sheet").then(
            (module) => module.NewTransactionSheet,
        ),
    { ssr: false },
);

const ImportTransactionsDialog = dynamic(
    () =>
        import("@/components/import-transactions-dialog").then(
            (module) => module.ImportTransactionsDialog,
        ),
    { ssr: false },
);

const NewTransferSheet = dynamic(
    () =>
        import("@/components/new-transfer-sheet").then(
            (module) => module.NewTransferSheet,
        ),
    { ssr: false },
);


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
    const { categories } = useCategories();
    const { addTransaction, addTransfer, importTransactions } = useTransactionData();
    const { activeAccounts } = useAccounts();
    const { user, activeYear } = useAuth();
    const { toast } = useToast();
    const [isImportSheetOpen, setIsImportSheetOpen] = useState(false);
    const [isNewTxSheetOpen, setIsNewTxSheetOpen] = useState(false);
    const [isTransferSheetOpen, setIsTransferSheetOpen] = useState(false);
    
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

    useEffect(() => {
        document.body.classList.add("ledgerly-app-shell");
        document.body.classList.toggle("ledgerly-app-shell--with-ads", showAds);

        return () => {
            document.body.classList.remove(
                "ledgerly-app-shell",
                "ledgerly-app-shell--with-ads",
            );
        };
    }, [showAds]);
    
    return (
        <SidebarProvider>
            <a
                href="#main-content"
                className="fixed left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[100] -translate-y-24 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
            >
                Skip to main content
            </a>
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
                 <header className="sticky top-0 z-20 flex h-[calc(3.75rem+env(safe-area-inset-top))] shrink-0 items-center gap-1.5 border-b bg-card/90 px-3 pt-[env(safe-area-inset-top)] shadow-sm shadow-foreground/[0.03] backdrop-blur-xl md:h-16 md:gap-2 md:px-4 md:pt-0">
                    <SidebarTrigger aria-label="Open navigation menu" />
                    <YearSwitcher />
                    <AccountSwitcher />
                    <div className="hidden md:block">
                        <ComparisonSwitcher />
                    </div>

                    <div className="ml-auto flex min-w-0 items-center gap-1.5 md:gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isReadOnly}
                            title={isReadOnly ? "You cannot import transactions into a past year." : "Import transactions"}
                            className="hidden items-center md:flex"
                            onClick={() => setIsImportSheetOpen(true)}
                        >
                            <Download className="h-4 w-4 md:mr-2" />
                            <span>Import</span>
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isReadOnly || activeAccounts.length < 2}
                            title={
                                activeAccounts.length < 2
                                    ? "Add a second account to create a transfer."
                                    : "Transfer money between accounts"
                            }
                            className="hidden items-center lg:flex"
                            onClick={() => setIsTransferSheetOpen(true)}
                        >
                            <ArrowRightLeft className="h-4 w-4 lg:mr-2" />
                            <span>Transfer</span>
                        </Button>

                        <Button
                            size="sm"
                            disabled={isReadOnly}
                            title={isReadOnly ? "You cannot add transactions to a past year." : "Add new transaction"}
                            aria-label={isReadOnly ? "Adding transactions is unavailable for past years" : "Add transaction"}
                            className="h-11 min-w-11 px-3 md:h-9"
                            onClick={() => setIsNewTxSheetOpen(true)}
                        >
                            <PlusCircle className="h-4 w-4 min-[360px]:mr-1.5 md:mr-2" />
                            <span className="hidden min-[360px]:inline md:hidden">Add</span>
                            <span className="hidden md:inline">New</span>
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 lg:hidden"
                                    aria-label="Open quick actions"
                                >
                                    <MoreHorizontal className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
                                <DropdownMenuItem
                                    disabled={isReadOnly || activeAccounts.length < 2}
                                    onSelect={() => setIsTransferSheetOpen(true)}
                                    className="min-h-11"
                                >
                                    <ArrowRightLeft className="h-4 w-4" />
                                    <span>Transfer between accounts</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    disabled={isReadOnly}
                                    onSelect={() => setIsImportSheetOpen(true)}
                                    className="min-h-11"
                                >
                                    <Download className="h-4 w-4" />
                                    <span>Import transactions</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div>
                            <UserNav />
                        </div>
                    </div>
                    {isImportSheetOpen ? (
                        <ImportTransactionsDialog
                            isOpen={isImportSheetOpen}
                            onOpenChange={setIsImportSheetOpen}
                            onTransactionsImported={importTransactions}
                        />
                    ) : null}
                    {isNewTxSheetOpen ? (
                        <NewTransactionSheet
                            isOpen={isNewTxSheetOpen}
                            onOpenChange={setIsNewTxSheetOpen}
                            onTransactionCreated={async (values) => {
                                await addTransaction({...values, date: values.date.toISOString()});
                            }}
                            categories={categories}
                        />
                    ) : null}
                    {isTransferSheetOpen ? (
                        <NewTransferSheet
                            isOpen={isTransferSheetOpen}
                            onOpenChange={setIsTransferSheetOpen}
                            onTransferCreated={async (transfer) => {
                                await addTransfer(transfer);
                                toast({
                                    title: "Transfer created",
                                    description:
                                        "Both account entries were created without changing income or expenses.",
                                });
                            }}
                        />
                    ) : null}
                </header>
                <div className={cn("ledgerly-app-content flex-1", showAds && "ledgerly-app-content--with-ads")}>
                    <main
                        id="main-content"
                        tabIndex={-1}
                        className="flex-1 overflow-y-auto p-4 outline-none md:p-6 lg:p-8 xl:p-10"
                    >
                        {children}
                    </main>
                </div>
                 {showAds && (
                    <footer className="ledgerly-ad-footer fixed right-0 z-30 w-full transition-[width] md:w-[calc(100%-16rem)] peer-data-[collapsible=icon]:w-[calc(100%-3rem)]">
                        <AdBanner showAds={showAds} slot="9876543210" className="mx-auto" />
                    </footer>
                )}
                <MobileBottomNav />
            </SidebarInset>
        </SidebarProvider>
    )
}

function AccountDataBoundary({
  children,
  showAds,
}: {
  children: React.ReactNode;
  showAds: boolean;
}) {
  const { loading, error, primaryAccountId } = useAccounts();

  if (loading) return <AppLayoutSkeleton />;
  if (error && !primaryAccountId) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-md rounded-xl border bg-card p-6 text-center">
          <h1 className="font-headline text-xl font-semibold">
            Accounts could not be prepared
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your existing data has not been changed. Refresh the page to
            try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TransactionDataProvider>
      <EnvelopesProvider>
        <UserDataProvider>
          <ComparisonProvider>
            <AdSenseScript showAds={showAds} />
            <MainAppShell>{children}</MainAppShell>
          </ComparisonProvider>
        </UserDataProvider>
      </EnvelopesProvider>
    </TransactionDataProvider>
  );
}


function AuthenticatedAppLayout({ children }: { children: React.ReactNode }) {
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
      <AccountsProvider>
        <AccountDataBoundary showAds={showAds}>
          {children}
        </AccountDataBoundary>
      </AccountsProvider>
  )
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProviders enableChat>
      <AuthenticatedAppLayout>{children}</AuthenticatedAppLayout>
    </AppProviders>
  );
}
