
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { authState } from '@/lib/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  onboardingComplete: boolean;
  setOnboardingComplete: (complete: boolean) => void;
  showInstructions: boolean;
  setShowInstructions: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  onboardingComplete: false,
  setOnboardingComplete: () => {},
  showInstructions: false,
  setShowInstructions: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingCompleteState] = useState(false);
  const [showInstructions, setShowInstructionsState] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(authState, async (user) => {
      setUser(user);
      if (user) {
        const userDocRef = doc(db, 'users', user.uid, 'settings', 'main');
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setOnboardingCompleteState(data.onboardingComplete || false);
          setShowInstructionsState(data.showInstructions || false);
        } else {
          // New user, set defaults
          setOnboardingCompleteState(false);
          setShowInstructionsState(false);
        }
      } else {
        // No user
        setOnboardingCompleteState(false);
        setShowInstructionsState(false);
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

  return (
    <AuthContext.Provider value={{ user, loading, onboardingComplete, setOnboardingComplete, showInstructions, setShowInstructions }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
