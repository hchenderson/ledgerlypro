
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowRightLeft,
  PieChart,
  Tag,
  Rocket,
  Settings,
  Target,
  Camera,
  Repeat,
  Flag,
  Bot,
  GitCompare,
  WalletCards,
  BookOpenText,
  ListChecks,
} from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import type { NavItem } from "@/types";

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, variant: "default" },
  { title: "Transactions", href: "/transactions", icon: ArrowRightLeft, variant: "ghost" },
  { title: "Needs Categorization", href: "/transactions/review", icon: ListChecks, variant: "ghost", badge: "New" },
  { title: "Accounts", href: "/accounts", icon: WalletCards, variant: "ghost", badge: "New" },
  { title: "Categories", href: "/categories", icon: Tag, variant: "ghost" },
  { title: "Reports", href: "/reports", icon: PieChart, variant: "ghost" },
  { title: "Compare", href: "/compare", icon: GitCompare, variant: "ghost", badge: "New" },
  { title: "Budgets", href: "/budgets", icon: Target, variant: "ghost" },
  { title: "Goals", href: "/goals", icon: Flag, variant: "ghost", badge: "New" },
  { title: "Recurring", href: "/recurring", icon: Repeat, variant: "ghost" },
  { title: "Chat", href: "/chat", icon: Bot, variant: "ghost", badge: "AI" },
  { title: "Receipt Scanner", href: "/receipt-scanner", icon: Camera, variant: "ghost", badge: "AI" },
  { title: "Projections", href: "/projections", icon: Rocket, variant: "ghost", badge: "AI" },
];


const settingsNavItem: NavItem = { title: "Settings", href: "/settings", icon: Settings, variant: "ghost" };
const guideNavItem: NavItem = { title: "How to Use", href: "/how-to-use", icon: BookOpenText, variant: "ghost" };


export function MainNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    // The mobile sidebar is rendered inside a Sheet, so MainNav mounts when
    // the drawer opens. Closing on that initial mount makes the drawer appear
    // to retract immediately. Only close it when an already-mounted menu sees
    // an actual route change; link clicks below still close it immediately.
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;
      setOpenMobile(false);
    }
  }, [pathname, setOpenMobile]);

  const renderNavItem = (item: NavItem) => (
    <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
        asChild
        isActive={item.href === "/reports" ? pathname.startsWith(item.href) : pathname === item.href}
        tooltip={{ children: item.title }}
        onClick={() => setOpenMobile(false)}
        >
        <Link href={item.href}>
            <item.icon />
            <span>{item.title}</span>
            {item.badge && <span className="ml-auto text-xs bg-primary/20 text-primary-foreground rounded-full px-2 py-0.5">{item.badge}</span>}
        </Link>
        </SidebarMenuButton>
    </SidebarMenuItem>
  )

  return (
    <SidebarMenu>
      {navItems.map(renderNavItem)}
      <SidebarMenuItem>
         <hr className="mx-2 my-2 border-sidebar-border"/>
      </SidebarMenuItem>
      {renderNavItem(guideNavItem)}
      {renderNavItem(settingsNavItem)}
    </SidebarMenu>
  );
}
