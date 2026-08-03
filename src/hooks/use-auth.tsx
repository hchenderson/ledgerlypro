
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { BudgetingMode, EnvelopeSettings, ForecastSettings } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  onboardingComplete: boolean;
  setOnboardingComplete: (complete: boolean) => Promise<void>;
  showInstructions: boolean;
  setShowInstructions: (show: boolean) => void;
  activeYear: number;
  setActiveYear: (year: number) => void;
  firstYear: number;
  budgetingMode: BudgetingMode;
  setBudgetingMode: (mode: BudgetingMode) => Promise<void>;
  envelopeSettings: EnvelopeSettings;
  setEnvelopeSettings: (settings: Partial<EnvelopeSettings>) => Promise<void>;
  forecastSettings: ForecastSettings;
  setForecastSettings: (settings: Partial<ForecastSettings>) => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  onboardingComplete: false,
  setOnboardingComplete: async () => {},
  showInstructions: false,
  setShowInstructions: () => {},
  activeYear: new Date().getFullYear(),
  setActiveYear: () => {},
  firstYear: new Date().getFullYear(),
  budgetingMode: "tracking",
  setBudgetingMode: async () => {},
  envelopeSettings: { minimumOperatingBalance: 0, fundingSuggestions: true },
  setEnvelopeSettings: async () => {},
  forecastSettings: {},
  setForecastSettings: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingCompleteState] = useState(false);
  const [showInstructions, setShowInstructionsState] = useState(false);
  const [activeYear, setActiveYearState] = useState(new Date().getFullYear());
  const [firstYear, setFirstYearState] = useState(new Date().getFullYear());
  const [budgetingMode, setBudgetingModeState] =
    useState<BudgetingMode>("tracking");
  const [envelopeSettings, setEnvelopeSettingsState] =
    useState<EnvelopeSettings>({
      minimumOperatingBalance: 0,
      fundingSuggestions: true,
    });
  const [forecastSettings, setForecastSettingsState] = useState<ForecastSettings>({});

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
          budgetingMode: "tracking" as BudgetingMode,
          envelopeSettings: {
            minimumOperatingBalance: 0,
            fundingSuggestions: true,
          } as EnvelopeSettings,
          forecastSettings: {},
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
        setBudgetingModeState(settingsData.budgetingMode || "tracking");
        setEnvelopeSettingsState({
          minimumOperatingBalance:
            settingsData.envelopeSettings?.minimumOperatingBalance ?? 0,
          fundingSuggestions:
            settingsData.envelopeSettings?.fundingSuggestions ?? true,
        });
        setForecastSettingsState(settingsData.forecastSettings || {});

      } else {
        // No user, reset to defaults
        setOnboardingCompleteState(false);
        setShowInstructionsState(false);
        setActiveYearState(new Date().getFullYear());
        setFirstYearState(new Date().getFullYear());
        setBudgetingModeState("tracking");
        setEnvelopeSettingsState({
          minimumOperatingBalance: 0,
          fundingSuggestions: true,
        });
        setForecastSettingsState({});
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

  const setBudgetingMode = useCallback(async (mode: BudgetingMode) => {
    setBudgetingModeState(mode);
    if (user) {
      const userDocRef = doc(db, 'users', user.uid, 'settings', 'main');
      await setDoc(userDocRef, { budgetingMode: mode }, { merge: true });
    }
  }, [user]);

  const setEnvelopeSettings = useCallback(async (settings: Partial<EnvelopeSettings>) => {
    const nextSettings = { ...envelopeSettings, ...settings };
    setEnvelopeSettingsState(nextSettings);
    if (user) {
      const userDocRef = doc(db, 'users', user.uid, 'settings', 'main');
      await setDoc(userDocRef, { envelopeSettings: nextSettings }, { merge: true });
    }
  }, [envelopeSettings, user]);
  
   const setForecastSettings = useCallback(async (settings: Partial<ForecastSettings>) => {
    if (user) {
        const userDocRef = doc(db, 'users', user.uid, 'settings', 'main');
        
        const newSettings: ForecastSettings = {
            ...forecastSettings,
            ...settings,
            baselineExclusions: {
                ...(forecastSettings.baselineExclusions || {}),
                ...(settings.baselineExclusions || {}),
            }
        };

        if (!newSettings.baselineExclusions?.categories?.length && !newSettings.baselineExclusions?.merchants?.length) {
            delete newSettings.baselineExclusions;
        }

        setForecastSettingsState(newSettings);
        await setDoc(userDocRef, { forecastSettings: newSettings }, { merge: true });
    }
  }, [user, forecastSettings]);

  return (
    <AuthContext.Provider value={{ user, loading, onboardingComplete, setOnboardingComplete, showInstructions, setShowInstructions, activeYear, setActiveYear, firstYear, budgetingMode, setBudgetingMode, envelopeSettings, setEnvelopeSettings, forecastSettings, setForecastSettings }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
