import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Transaction } from "@/types";
import { TrendingUp, TrendingDown, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccounts } from "@/hooks/use-accounts";

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const { getAccountName } = useAccounts();

  return (
    <div className="min-w-0 space-y-4">
      {transactions.map((transaction) => (
        <div key={transaction.id} className="flex min-w-0 items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback
              className={cn(
                "font-bold",
                transaction.type === "income"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                  : transaction.type === "transfer"
                    ? "bg-secondary text-primary"
                    : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
              )}
            >
              {transaction.type === "income" ? (
                <TrendingUp className="h-4 w-4" />
              ) : transaction.type === "expense" ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm font-medium leading-none" title={transaction.description}>
              {transaction.description}
            </p>
            <p
              className="truncate text-xs text-muted-foreground sm:text-sm"
              title={`${transaction.category} · ${getAccountName(transaction.accountId)}`}
            >
              {transaction.category} · {getAccountName(transaction.accountId)}
            </p>
          </div>
          <div
            className={cn(
              "max-w-[45%] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-right font-code text-sm font-medium tabular-nums sm:text-base",
              transaction.type === "income"
                ? "text-emerald-600"
                : transaction.type === "transfer"
                  ? "text-primary"
                  : "text-foreground"
            )}
            title={`${transaction.type === "income" || (transaction.type === "transfer" && transaction.transferDirection === "in") ? "+" : "-"}${new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(transaction.amount)}`}
          >
            {transaction.type === "income" ||
            (transaction.type === "transfer" &&
              transaction.transferDirection === "in")
              ? "+"
              : "-"}
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(transaction.amount)}
          </div>
        </div>
      ))}
    </div>
  );
}
