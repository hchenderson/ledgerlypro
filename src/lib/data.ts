
import type { Budget, Category, Goal, RecurringTransaction, Transaction } from "@/types";

export const defaultCategories: Omit<Category, 'id'>[] = [
    {
        id: "cat_inc_1",
        name: "Income",
        type: "income",
        icon: "Landmark",
        subCategories: [
            { id: "sub_inc_1", name: "Salary", subCategories: [] },
            { id: "sub_inc_2", name: "Freelance", subCategories: [] },
            { id: "sub_inc_3", name: "Investment", subCategories: [] },
        ],
    },
    {
        id: "cat_exp_1",
        name: "Home & Utilities",
        type: "expense",
        icon: "Home",
        subCategories: [
            { id: "sub_exp_1", name: "Rent/Mortgage", subCategories: [] },
            { id: "sub_exp_2", name: "Electricity", subCategories: [] },
            { id: "sub_exp_3", name: "Water", subCategories: [] },
            { id: "sub_exp_4", name: "Internet", subCategories: [] },
        ],
    },
    {
        id: "cat_exp_2",
        name: "Food & Dining",
        type: "expense",
        icon: "Utensils",
        subCategories: [
            { id: "sub_exp_5", name: "Groceries", subCategories: [] },
            { id: "sub_exp_6", name: "Restaurants", subCategories: [] },
            { id: "sub_exp_7", name: "Coffee Shops", subCategories: [] },
        ],
    },
    {
        id: "cat_exp_3",
        name: "Shopping",
        type: "expense",
        icon: "ShoppingBag",
        subCategories: [
            { id: "sub_exp_8", name: "Clothing", subCategories: [] },
            { id: "sub_exp_9", name: "Electronics", subCategories: [] },
            { id: "sub_exp_10", name: "Hobbies", subCategories: [] },
        ],
    },
    {
        id: "cat_exp_4",
        name: "Transportation",
        type: "expense",
        icon: "Car",
        subCategories: [
            { id: "sub_exp_11", name: "Gas/Fuel", subCategories: [] },
            { id: "sub_exp_12", name: "Public Transit", subCategories: [] },
            { id: "sub_exp_13", name: "Ride Sharing", subCategories: [] },
        ]
    }
];

const now = new Date();
export const defaultTransactions: Omit<Transaction, 'id'>[] = [
    {
        date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        description: "Monthly Salary",
        amount: 5000,
        type: "income",
        category: "Salary",
    },
    {
        date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        description: "Rent Payment",
        amount: 1500,
        type: "expense",
        category: "Rent/Mortgage",
    },
    {
        date: new Date(now.getFullYear(), now.getMonth(), 2).toISOString(),
        description: "Weekly Groceries",
        amount: 120.50,
        type: "expense",
        category: "Groceries",
    },
    {
        date: new Date(now.getFullYear(), now.getMonth(), 3).toISOString(),
        description: "Dinner with friends",
        amount: 75.00,
        type: "expense",
        category: "Restaurants",
    },
     {
        date: new Date(now.getFullYear(), now.getMonth(), 5).toISOString(),
        description: "Internet Bill",
        amount: 60.00,
        type: "expense",
        category: "Internet",
    },
];

export const defaultBudgets: Omit<Budget, 'id'>[] = [
    {
        categoryId: "sub_exp_5", // Groceries
        amount: 400,
        period: "monthly",
        isFavorite: true,
    },
    {
        categoryId: "sub_exp_6", // Restaurants
        amount: 200,
        period: "monthly",
        isFavorite: false,
    },
     {
        categoryId: "sub_exp_8", // Clothing
        amount: 150,
        period: "monthly",
        isFavorite: false,
    }
];

export const defaultRecurringTransactions: Omit<RecurringTransaction, 'id' | 'lastAddedDate'>[] = [
    {
        description: "Netflix Subscription",
        amount: 15.99,
        type: "expense",
        category: "Hobbies",
        frequency: "monthly",
        startDate: new Date(now.getFullYear(), now.getMonth(), 10).toISOString(),
    },
    {
        description: "Rent",
        amount: 1500,
        type: "expense",
        category: "Rent/Mortgage",
        frequency: "monthly",
        startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    }
];


export const defaultGoals: Omit<Goal, 'id'>[] = [
    {
        name: "Vacation to Hawaii",
        targetAmount: 4000,
        savedAmount: 1200,
        targetDate: new Date(now.getFullYear() + 1, 5, 1).toISOString(),
    },
    {
        name: "New Laptop",
        targetAmount: 2500,
        savedAmount: 500,
    }
];
