import type { Transaction, Category } from "@/types";
import { Utensils, Car, Home, ShoppingBag, HeartPulse, Sparkles, HandCoins, Building, Shirt, Pizza, Plane } from "lucide-react";


export const allCategories: Category[] = [
    { id: "cat_1", name: "Food", type: "expense", icon: Utensils, subCategories: [
        { id: "sub_1", name: "Groceries", icon: ShoppingBag },
        { id: "sub_2", name: "Restaurants", icon: Pizza },
    ]},
    { id: "cat_2", name: "Transport", type: "expense", icon: Car, subCategories: [
        { id: "sub_3", name: "Gas", icon: Car },
        { id: "sub_4", name: "Public Transit", icon: Car },
    ] },
    { id: "cat_3", name: "Housing", type: "expense", icon: Home, subCategories: [
        { id: "sub_5", name: "Rent", icon: Home },
        { id: "sub_6", name: "Utilities", icon: Home },
    ]},
    { id: "cat_4", name: "Shopping", type: "expense", icon: ShoppingBag, subCategories: [
        { id: "sub_7", name: "Clothes", icon: Shirt },
        { id: "sub_8", name: "Electronics", icon: Sparkles },
    ]},
    { id: "cat_5", name: "Health", type: "expense", icon: HeartPulse },
    { id: "cat_6", name: "Salary", type: "income", icon: HandCoins },
    { id: "cat_7", name: "Business", type: "expense", icon: Building, subCategories: [
        { id: "sub_9", name: "Travel", icon: Plane },
        { id: "sub_10", name: "Software", icon: Sparkles },
    ]},
    { id: "cat_8", name: "Freelance", type: "income", icon: Sparkles },
    { id: "cat_9", name: "Investments", type: "income", icon: Sparkles },
    { id: "cat_10", name: "Other", type: "expense", icon: Sparkles },
    { id: "cat_11", name: "Other", type: "income", icon: Sparkles },
]


export const mockTransactions: Transaction[] = [
  {
    id: "txn_1",
    date: new Date("2024-07-15").toISOString(),
    description: "Monthly Salary",
    amount: 5000,
    type: "income",
    category: "Salary",
  },
  {
    id: "txn_2",
    date: new Date("2024-07-20").toISOString(),
    description: "Grocery Shopping",
    amount: 150.75,
    type: "expense",
    category: "Groceries",
  },
  {
    id: "txn_3",
    date: new Date("2024-07-18").toISOString(),
    description: "Gasoline",
    amount: 45.3,
    type: "expense",
    category: "Gas",
  },
  {
    id: "txn_4",
    date: new Date("2024-07-10").toISOString(),
    description: "Freelance Project",
    amount: 750,
    type: "income",
    category: "Freelance",
  },
  {
    id: "txn_5",
    date: new Date("2024-07-05").toISOString(),
    description: "Rent Payment",
    amount: 1200,
    type: "expense",
    category: "Rent",
  },
  {
    id: "txn_6",
    date: new Date("2024-07-22").toISOString(),
    description: "Dinner with friends",
    amount: 85.5,
    type: "expense",
    category: "Restaurants",
  },
  {
    id: "txn_7",
    date: new Date("2024-07-01").toISOString(),
    description: "Internet Bill",
    amount: 60,
    type: "expense",
    category: "Utilities",
  },
  {
    id: "txn_8",
    date: new Date("2024-06-25").toISOString(),
    description: "New Keyboard",
    amount: 250,
    type: "expense",
    category: "Electronics",
  },
  {
    id: "txn_9",
    date: new Date("2024-06-28").toISOString(),
    description: "Stock Dividend",
    amount: 120,
    type: "income",
    category: "Investments",
  },
];


export const mockOverviewData = [
  { name: "Jan", income: 4000, expense: 2400 },
  { name: "Feb", income: 3000, expense: 1398 },
  { name: "Mar", income: 5000, expense: 3800 },
  { name: "Apr", income: 2780, expense: 3908 },
  { name: "May", income: 1890, expense: 4800 },
  { name: "Jun", income: 4390, expense: 3800 },
  { name: "Jul", income: 5490, expense: 4300 },
]

export const mockCategoryData = [
  { category: "Food", amount: 850.50, fill: "hsl(var(--chart-1))" },
  { category: "Transport", amount: 320.00, fill: "hsl(var(--chart-2))" },
  { category: "Housing", amount: 1200.00, fill: "hsl(var(--chart-3))" },
  { category: "Social", amount: 250.75, fill: "hsl(var(--chart-4))" },
  { category: "Utilities", amount: 180.25, fill: "hsl(var(--chart-5))" },
  { category: "Other", amount: 400.00, fill: "hsl(var(--muted))" },
]
