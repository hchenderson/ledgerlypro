
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  onboardingComplete: boolean;
  setOnboardingComplete: (complete: boolean) => void;
  showInstructions: boolean;
  setShowInstructions: (show: boolean) => void;
  activeYear: number;
  setActiveYear: (year: number) => void;
  firstYear: number;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  onboardingComplete: false,
  setOnboardingComplete: () => {},
  showInstructions: false,
  setShowInstructions: () => {},
  activeYear: new Date().getFullYear(),
  setActiveYear: () => {},
  firstYear: new Date().getFullYear(),
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingCompleteState] = useState(false);
  const [showInstructions, setShowInstructionsState] = useState(false);
  const [activeYear, setActiveYearState] = useState(new Date().getFullYear());
  const [firstYear, setFirstYearState] = useState(new Date().getFullYear());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDocRef = doc(db, 'users', user.uid, 'settings', 'main');
        const userDoc = await getDoc(userDocRef);
        
        let settingsData = {
          onboardingComplete: false,
          showInstructions: false,
          activeYear: new Date().getFullYear(),
          firstYear: new Date().getFullYear(),
        };

        if (userDoc.exists()) {
          const existingData = userDoc.data();
          settingsData = { ...settingsData, ...existingData };
        } else {
          // If the doc doesn't exist, we will create it with defaults.
          await setDoc(userDocRef, settingsData, { merge: true });
        }
        
        setOnboardingCompleteState(prev => prev !== settingsData.onboardingComplete ? settingsData.onboardingComplete : prev);
        setShowInstructionsState(prev => prev !== settingsData.showInstructions ? settingsData.showInstructions : prev);
        setActiveYearState(prev => prev !== settingsData.activeYear ? settingsData.activeYear : prev);
        setFirstYearState(prev => prev !== settingsData.firstYear ? settingsData.firstYear : prev);

      } else {
        // No user, reset to defaults
        setOnboardingCompleteState(false);
        setShowInstructionsState(false);
        setActiveYearState(new Date().getFullYear());
        setFirstYearState(new Date().getFullYear());
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const setOnboardingComplete = useCallback(async (complete: boolean) => {
      setOnboardingCompleteState(complete);
      if (user) {
          const userDocRef = doc(db, 'users', user.uid, 'settings', 'main');
          await setDoc(userDocRef, { onboardingComplete: complete }, { merge: true });
      }
  }, [user]);

  const setShowInstructions = useCallback(async (show: boolean) => {
    setShowInstructionsState(show);
    if (user) {
        const userDocRef = doc(db, 'users', user.uid, 'settings', 'main');
        await setDoc(userDocRef, { showInstructions: show }, { merge: true });
    }
  }, [user]);
  
  const setActiveYear = useCallback(async (year: number) => {
    setActiveYearState(year);
    if (user) {
      const userDocRef = doc(db, 'users', user.uid, 'settings', 'main');
      await setDoc(userDocRef, { activeYear: year }, { merge: true });
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, onboardingComplete, setOnboardingComplete, showInstructions, setShowInstructions, activeYear, setActiveYear, firstYear }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

    