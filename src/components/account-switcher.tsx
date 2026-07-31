"use client";

import Link from "next/link";
import { WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccounts } from "@/hooks/use-accounts";

export function AccountSwitcher() {
  const {
    accounts,
    selectedAccountIds,
    allAccountsSelected,
    loading,
    toggleAccountSelection,
    selectAllAccounts,
  } = useAccounts();

  const selectedLabel = allAccountsSelected
    ? "All accounts"
    : selectedAccountIds.length === 1
      ? accounts.find(
          (account) => account.id === selectedAccountIds[0],
        )?.name ?? "1 account"
      : `${selectedAccountIds.length} accounts`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-11 w-11 shrink-0 px-0 md:h-10 lg:w-auto lg:max-w-44 lg:px-3"
          aria-label={`Filter by account. Currently ${selectedLabel}`}
          disabled={loading}
        >
          <WalletCards className="h-4 w-4 shrink-0 lg:mr-2" />
          <span className="hidden truncate lg:inline">
            {loading ? "Loading accounts…" : selectedLabel}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Accounts shown</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={allAccountsSelected}
          onCheckedChange={() => selectAllAccounts()}
          className="min-h-11"
        >
          All accounts
        </DropdownMenuCheckboxItem>
        {accounts.map((account) => (
          <DropdownMenuCheckboxItem
            key={account.id}
            checked={selectedAccountIds.includes(account.id)}
            onCheckedChange={() =>
              toggleAccountSelection(account.id)
            }
            className="min-h-11"
          >
            <span className="min-w-0 flex-1 truncate">
              {account.name}
            </span>
            {account.isArchived ? (
              <span className="ml-2 text-xs text-muted-foreground">
                Archived
              </span>
            ) : null}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11">
          <Link href="/accounts">Manage accounts</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
