
import type { Transaction, Category, Budget, RecurringTransaction } from "@/types";

export const defaultCategories: Omit<Category, 'icon'>[] = [
    { id: "cat_1", name: "Food", type: "expense", subCategories: [
        { id: "sub_1", name: "Groceries" },
        { id: "sub_2", name: "Restaurants", subCategories: [
            { id: "sub_11", name: "Fast Food" },
            { id: "sub_12", name: "Sit Down" },
        ] },
    ]},
    { id: "cat_2", name: "Transport", type: "expense", subCategories: [
        { id: "sub_3", name: "Gas" },
        { id: "sub_4", name: "Public Transit" },
    ] },
    { id: "cat_3", name: "Housing", type: "expense", subCategories: [
        { id: "sub_5", name: "Rent" },
        { id: "sub_6", name: "Utilities" },
    ]},
    { id: "cat_4", name: "Shopping", type: "expense", subCategories: [
        { id: "sub_7", name: "Clothes" },
        { id: "sub_8", name: "Electronics" },
    ]},
    { id: "cat_5", name: "Health", type: "expense" },
    { id: "cat_6", name: "Salary", type: "income" },
    { id: "cat_7", name: "Business", type: "expense", subCategories: [
        { id: "sub_9", name: "Travel" },
        { id: "sub_10", name: "Software" },
    ]},
    { id: "cat_8", name: "Freelance", type: "income" },
    { id: "cat_9", name: "Investments", type: "income" },
    { id: "cat_10", name: "Other", type: "expense" },
    { id: "cat_11", name: "Other", type: "income" },
]


export const defaultTransactions: Transaction[] = [
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
    category: "Sit Down",
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


export const defaultBudgets: Budget[] = [
    { id: 'bud_1', categoryId: 'cat_1', amount: 500, period: 'monthly', isFavorite: true }, // Food
    { id: 'bud_2', categoryId: 'cat_4', amount: 250, period: 'monthly' }, // Shopping
];

export const defaultRecurringTransactions: RecurringTransaction[] = [
    {
        id: 'rec_1',
        description: 'Netflix Subscription',
        amount: 15.99,
        type: 'expense',
        category: 'Other',
        frequency: 'monthly',
        startDate: new Date('2024-07-01').toISOString(),
    }
];
