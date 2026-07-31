"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRightLeft,
  LayoutDashboard,
  Menu,
  PieChart,
  Target,
} from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Transactions", href: "/transactions", icon: ArrowRightLeft },
  { title: "Reports", href: "/reports", icon: PieChart },
  { title: "Budgets", href: "/budgets", icon: Target },
] as const;

function isPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { openMobile, setOpenMobile } = useSidebar();
  const isMoreActive = !mobileNavItems.some((item) =>
    isPathActive(pathname, item.href),
  );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-18px_hsl(var(--foreground)/0.55)] backdrop-blur-xl md:hidden"
      aria-label="Primary mobile navigation"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 px-1">
        {mobileNavItems.map((item) => {
          const active = isPathActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 min-w-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.6875rem] font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                active && "bg-secondary/60 text-primary",
              )}
              onClick={() => setOpenMobile(false)}
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              <span className="max-w-full truncate">{item.title}</span>
            </Link>
          );
        })}

        <button
          type="button"
          aria-label="Open all navigation"
          aria-haspopup="dialog"
          aria-expanded={openMobile}
          className={cn(
            "flex min-h-11 min-w-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.6875rem] font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            isMoreActive && "bg-secondary/60 text-primary",
          )}
          onClick={() => setOpenMobile(true)}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
