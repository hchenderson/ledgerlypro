

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
  badge?: string;
};

export type SubCategory = {
    id: string;
    name: string;
    icon?: string; // Storing icon name as string
    subCategories?: SubCategory[]; // Make sub-categories recursive
};

export type Category = {
    id: string;
    name: string;
    type: "income" | "expense";
    icon?: string; // Storing icon name as string
    subCategories?: SubCategory[];
};

export type Budget = {
  id: string;
  categoryId: string;
  amount: number;
  period: "monthly" | "yearly";
  isFavorite?: boolean;
};

export type RecurringTransaction = {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  startDate: string;
  lastAddedDate?: string;
};

export type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate?: string;
}


export interface Widget {
  id: string;
  title: string;
  type: 'metric' | 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'composed';
  size: 'small' | 'medium' | 'large';
  mainDataKey: string | null;
  comparisonKey: string | null;
  dataCategories: string[];
  enabled: boolean;
  position: number;
  colorTheme: string;
  showLegend: boolean;
  showGrid: boolean;
  showTargetLines: boolean;
  height: number;
  customFilters: { categories: string[] };
  formulaId: string | null;
}

export interface Formula {
  id: string;
  name: string;
  expression: string;
}
    
