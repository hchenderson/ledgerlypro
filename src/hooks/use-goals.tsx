"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";

import { useFirestoreUserCollection } from "@/hooks/use-firestore-user-collection";
import type { Goal } from "@/types";

export interface GoalsContextType {
  goals: Goal[];
  loading: boolean;
  error: Error | null;
  addGoal: (goal: Omit<Goal, "id">) => Promise<void>;
  updateGoal: (
    id: string,
    values: Partial<Omit<Goal, "id">>,
  ) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addContributionToGoal: (
    goalId: string,
    amount: number,
  ) => Promise<void>;
}

const GoalsContext = createContext<GoalsContextType | null>(null);

export function GoalsProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const {
    items: goals,
    loading,
    error,
    collectionRef,
  } = useFirestoreUserCollection<Goal>("goals", { enabled });

  const addGoal = useCallback(
    async (goal: Omit<Goal, "id">) => {
      if (!collectionRef) return;
      const newDocumentRef = doc(collectionRef);
      await setDoc(newDocumentRef, {
        ...goal,
        id: newDocumentRef.id,
      });
    },
    [collectionRef],
  );

  const updateGoal = useCallback(
    async (
      id: string,
      values: Partial<Omit<Goal, "id">>,
    ) => {
      if (!collectionRef) return;
      await setDoc(doc(collectionRef, id), values, { merge: true });
    },
    [collectionRef],
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      if (!collectionRef) return;
      await deleteDoc(doc(collectionRef, id));
    },
    [collectionRef],
  );

  const addContributionToGoal = useCallback(
    async (goalId: string, amount: number) => {
      if (!collectionRef) return;
      const goalDocumentRef = doc(collectionRef, goalId);
      const goalSnapshot = await getDoc(goalDocumentRef);
      if (!goalSnapshot.exists()) return;
      const goal = goalSnapshot.data() as Goal;
      await setDoc(
        goalDocumentRef,
        { savedAmount: (goal.savedAmount ?? 0) + amount },
        { merge: true },
      );
    },
    [collectionRef],
  );

  const value = useMemo<GoalsContextType>(
    () => ({
      goals,
      loading,
      error,
      addGoal,
      updateGoal,
      deleteGoal,
      addContributionToGoal,
    }),
    [
      addContributionToGoal,
      addGoal,
      deleteGoal,
      error,
      goals,
      loading,
      updateGoal,
    ],
  );

  return (
    <GoalsContext.Provider value={value}>
      {children}
    </GoalsContext.Provider>
  );
}

export function useGoals(): GoalsContextType {
  const context = useContext(GoalsContext);
  if (!context) {
    throw new Error("useGoals must be used within GoalsProvider");
  }
  return context;
}
