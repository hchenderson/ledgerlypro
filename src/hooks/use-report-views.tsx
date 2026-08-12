"use client";

import { useCallback } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";

import { useFirestoreUserCollection } from "@/hooks/use-firestore-user-collection";
import type {
  ReportComparisonMode,
  ReportGranularity,
  ReportMetricId,
  ReportSectionId,
} from "@/lib/report-analytics";

export interface ReportViewConfiguration {
  reportPeriod: "monthly" | "yearly";
  from: string;
  to: string;
  comparisonMode: ReportComparisonMode;
  comparisonFrom?: string;
  comparisonTo?: string;
  accountIds: string[];
  transactionTypes: ("income" | "expense")[];
  includedCategoryKeys: string[];
  excludedCategoryKeys: string[];
  includePending: boolean;
  includeTransfers: boolean;
  granularity: ReportGranularity;
  visibleSections: ReportSectionId[];
  sectionOrder: ReportSectionId[];
  visibleMetrics: ReportMetricId[];
}

export interface SavedReportView {
  id: string;
  name: string;
  configuration: ReportViewConfiguration;
  createdAt: string;
  updatedAt: string;
}

export function useReportViews() {
  const {
    items: views,
    loading,
    error,
    collectionRef,
  } = useFirestoreUserCollection<SavedReportView>("reportViews");

  const saveView = useCallback(
    async (
      name: string,
      configuration: ReportViewConfiguration,
      existingId?: string,
    ) => {
      if (!collectionRef) throw new Error("User not authenticated");
      const documentRef = existingId
        ? doc(collectionRef, existingId)
        : doc(collectionRef);
      const now = new Date().toISOString();
      await setDoc(
        documentRef,
        {
          id: documentRef.id,
          name: name.trim(),
          configuration,
          updatedAt: now,
          ...(existingId ? {} : { createdAt: now }),
        },
        { merge: true },
      );
      return documentRef.id;
    },
    [collectionRef],
  );

  const deleteView = useCallback(
    async (id: string) => {
      if (!collectionRef) throw new Error("User not authenticated");
      await deleteDoc(doc(collectionRef, id));
    },
    [collectionRef],
  );

  return { views, loading, error, saveView, deleteView };
}
