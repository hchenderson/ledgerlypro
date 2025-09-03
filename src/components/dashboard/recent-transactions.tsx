import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Transaction } from "@/types";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <div className="space-y-4">
      {transactions.map((transaction) => (
        <div key={transaction.id} className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarFallback
              className={cn(
                "font-bold",
                transaction.type === "income"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
              )}
            >
              {transaction.type === "income" ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
            </AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">{transaction.description}</p>
            <p className="text-sm text-muted-foreground">{transaction.category}</p>
          </div>
          <div
            className={cn(
              "ml-auto font-medium font-code",
              transaction.type === "income" ? "text-emerald-600" : "text-foreground"
            )}
          >
            {transaction.type === "income" ? "+" : "-"}
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
