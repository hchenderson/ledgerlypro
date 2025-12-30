
"use client";

import React, { createContext, useContext, useState, useMemo } from 'react';

interface ComparisonContextType {
  comparisonYear: number | undefined;
  setComparisonYear: (year: number | undefined) => void;
  isComparing: boolean;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export const ComparisonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [comparisonYear, setComparisonYear] = useState<number | undefined>(undefined);

  const value = useMemo(() => ({
    comparisonYear,
    setComparisonYear,
    isComparing: comparisonYear !== undefined,
  }), [comparisonYear]);

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
