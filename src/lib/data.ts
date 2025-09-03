import type { Transaction } from "@/types";

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
    category: "Food",
  },
  {
    id: "txn_3",
    date: new Date("2024-07-18").toISOString(),
    description: "Gasoline",
    amount: 45.3,
    type: "expense",
    category: "Transport",
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
    category: "Housing",
  },
  {
    id: "txn_6",
    date: new Date("2024-07-22").toISOString(),
    description: "Dinner with friends",
    amount: 85.5,
    type: "expense",
    category: "Social",
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
    category: "Shopping",
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

export const mockCategories = {
  income: [
    { value: 'Salary', label: 'Salary' },
    { value: 'Freelance', label: 'Freelance' },
    { value: 'Investments', label: 'Investments' },
    { value: 'Other', label: 'Other' },
  ],
  expense: [
    { value: 'Food', label: 'Food' },
    { value: 'Transport', label: 'Transport' },
    { value: 'Housing', label: 'Housing' },
    { value: 'Social', label: 'Social' },
    { value: 'Utilities', label: 'Utilities' },
    { value: 'Shopping', label: 'Shopping' },
    { value: 'Health', label: 'Health' },
    { value: 'Other', label: 'Other' },
  ]
}

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
