
"use client";

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
  Sparkles,
} from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import type { NavItem } from "@/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, variant: "default" },
  { title: "Transactions", href: "/transactions", icon: ArrowRightLeft, variant: "ghost" },
  { title: "Categories", href: "/categories", icon: Tag, variant: "ghost" },
  // { title: "Reports", href: "/reports", icon: PieChart, variant: "ghost" },
  { title: "Budgets", href: "/budgets", icon: Target, variant: "ghost" },
  { title: "Goals", href: "/goals", icon: Flag, variant: "ghost", badge: "New" },
  { title: "Recurring", href: "/recurring", icon: Repeat, variant: "ghost" },
  { title: "Receipt Scanner", href: "/receipt-scanner", icon: Camera, variant: "ghost", badge: "AI" },
  { title: "Projections", href: "/projections", icon: Rocket, variant: "ghost", badge: "AI" },
];


const settingsNavItem: NavItem = { title: "Settings", href: "/settings", icon: Settings, variant: "ghost" };


export function MainNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const isReportsActive = pathname.startsWith('/reports');

  const renderNavItem = (item: NavItem) => (
    <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
        asChild
        isActive={pathname === item.href}
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

      <Collapsible asChild>
        <SidebarMenuItem>
            <CollapsibleTrigger asChild>
                <SidebarMenuButton
                    isActive={isReportsActive}
                    tooltip={{children: "Reports"}}
                    >
                    <PieChart/>
                    <span>Reports</span>
                </SidebarMenuButton>
            </CollapsibleTrigger>
             <CollapsibleContent asChild>
                <SidebarMenuSub>
                    <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                            asChild
                            isActive={pathname === "/reports"}
                            onClick={() => setOpenMobile(false)}
                        >
                            <Link href="/reports">
                                <span>Summary</span>
                            </Link>
                        </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                            asChild
                            isActive={pathname === "/reports/advanced"}
                            onClick={() => setOpenMobile(false)}
                        >
                            <Link href="/reports/advanced">
                                 <Sparkles className="text-yellow-400" />
                                <span>Advanced</span>
                            </Link>
                        </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                </SidebarMenuSub>
            </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>


      <SidebarMenuItem>
         <hr className="mx-2 my-2 border-sidebar-border"/>
      </SidebarMenuItem>
      {renderNavItem(settingsNavItem)}
    </SidebarMenu>
  );
}
