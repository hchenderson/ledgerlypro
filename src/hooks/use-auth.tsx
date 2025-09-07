
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { authState } from '@/lib/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Plan = 'free' | 'pro';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  plan: Plan;
  setPlan: (plan: Plan) => void;
  onboardingComplete: boolean;
  setOnboardingComplete: (complete: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  plan: 'free',
  setPlan: () => {},
  onboardingComplete: false,
  setOnboardingComplete: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlanState] = useState<Plan>('free');
  const [onboardingComplete, setOnboardingCompleteState] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(authState, async (user) => {
      setUser(user);
      if (user) {
        const userDocRef = doc(db, 'users', user.uid, 'settings', 'main');
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setPlanState(data.plan || 'free');
          setOnboardingCompleteState(data.onboardingComplete || false);
        } else {
          // New user, set defaults
          setPlanState('free');
          setOnboardingCompleteState(false);
        }
      } else {
        // No user
        setPlanState('free');
        setOnboardingCompleteState(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const setPlan = useCallback(async (newPlan: Plan) => {
    setPlanState(newPlan);
    if (user) {
      const userDocRef = doc(db, 'users', user.uid, 'settings', 'main');
      await setDoc(userDocRef, { plan: newPlan }, { merge: true });
    }
  }, [user]);

  const setOnboardingComplete = useCallback(async (complete: boolean) => {
      setOnboardingCompleteState(complete);
      if (user) {
          const userDocRef = doc(db, 'users', user.uid, 'settings', 'main');
          await setDoc(userDocRef, { onboardingComplete: complete }, { merge: true });
      }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, plan, setPlan, onboardingComplete, setOnboardingComplete }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
