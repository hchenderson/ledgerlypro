
"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface ComparisonContextType {
  comparisonYear: number | undefined;
  setComparisonYear: (year: number | undefined) => void;
  isComparing: boolean;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export const ComparisonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [comparisonYear, setComparisonYear] = useState<number | undefined>(undefined);

  useEffect(() => {
    const savedYear = window.localStorage.getItem('ledgerly-comparison-year');
    if (!savedYear) return;
    const parsedYear = Number(savedYear);
    if (Number.isInteger(parsedYear)) setComparisonYear(parsedYear);
  }, []);

  const updateComparisonYear = useCallback((year: number | undefined) => {
    setComparisonYear(year);
    if (year === undefined) {
      window.localStorage.removeItem('ledgerly-comparison-year');
    } else {
      window.localStorage.setItem('ledgerly-comparison-year', String(year));
    }
  }, []);

  const value = useMemo(() => ({
    comparisonYear,
    setComparisonYear: updateComparisonYear,
    isComparing: comparisonYear !== undefined,
  }), [comparisonYear, updateComparisonYear]);

  return (
    <ComparisonContext.Provider value={value}>
      {children}
    </ComparisonContext.Provider>
  );
};

export const useComparison = () => {
  const context = useContext(ComparisonContext);
  if (context === undefined) {
    throw new Error('useComparison must be used within a ComparisonProvider');
  }
  return context;
};
