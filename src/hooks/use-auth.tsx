
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { authState } from '@/lib/auth';

type Plan = 'free' | 'pro';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  plan: Plan;
  setPlan: (plan: Plan) => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  plan: 'free',
  setPlan: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlanState] = useState<Plan>('free');

  const getStorageKey = useCallback((key: string) => {
    if (!user) return null;
    return `${key}_${user.uid}`;
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(authState, (user) => {
      setUser(user);
      if (user) {
        const storedPlan = localStorage.getItem(getStorageKey('user_plan') || 'user_plan') as Plan;
        if (storedPlan) {
          setPlanState(storedPlan);
        } else {
          setPlanState('free');
        }
      } else {
        setPlanState('free');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [getStorageKey]);

  const setPlan = useCallback((newPlan: Plan) => {
    setPlanState(newPlan);
    const storageKey = getStorageKey('user_plan');
    if (storageKey) {
        localStorage.setItem(storageKey, newPlan);
    }
  }, [getStorageKey]);

  return (
    <AuthContext.Provider value={{ user, loading, plan, setPlan }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
