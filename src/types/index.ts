import type { LucideIcon } from "lucide-react";

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
};

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  variant: "default" | "ghost";
};
