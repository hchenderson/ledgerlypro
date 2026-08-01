"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import {
  useFirestoreUserCollection,
  userCollectionRef,
} from "@/hooks/use-firestore-user-collection";
import { useAuth } from "@/hooks/use-auth";
import { chunkArray } from "@/lib/batching";
import {
  buildCategoryPathLabel,
  findCategoryByPath,
  type CategoryTreeItem,
} from "@/lib/category-tree";
import { db } from "@/lib/firebase";
import type {
  Category,
  SubCategory,
  Transaction,
} from "@/types";

export interface CategoriesContextType {
  categories: Category[];
  loading: boolean;
  error: Error | null;
  addCategory: (category: Omit<Category, "id">) => Promise<Category>;
  addSubCategory: (
    parentId: string,
    subCategory: Omit<SubCategory, "id">,
    parentPath?: string[],
  ) => Promise<SubCategory>;
  updateCategory: (
    id: string,
    oldName: string,
    newName: string,
  ) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updateSubCategory: (
    categoryId: string,
    subCategoryId: string,
    oldName: string,
    newName: string,
    parentPath?: string[],
  ) => Promise<void>;
  deleteSubCategory: (
    categoryId: string,
    subCategoryId: string,
    parentPath?: string[],
  ) => Promise<void>;
  importCategories: (
    importedData: {
      name: string;
      type: "income" | "expense";
      parent_name: string;
    }[],
  ) => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextType | null>(null);

async function updateTransactionCategoryLabels(
  documents: Awaited<ReturnType<typeof getDocs>>["docs"],
  label: string,
) {
  for (const documentChunk of chunkArray(documents, 450)) {
    const batch = writeBatch(db);
    documentChunk.forEach((transactionDocument) => {
      batch.update(transactionDocument.ref, { category: label });
    });
    await batch.commit();
  }
}

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const {
    items: categories,
    loading,
    error,
    collectionRef,
  } = useFirestoreUserCollection<Category>("categories");
  const migrationUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      migrationUserRef.current = null;
      return;
    }
    if (
      loading ||
      categories.length === 0 ||
      migrationUserRef.current === user.uid
    ) {
      return;
    }

    migrationUserRef.current = user.uid;
    const migrateCategoryIds = async () => {
      const settingsRef = doc(
        db,
        "users",
        user.uid,
        "settings",
        "main",
      );
      const settingsSnapshot = await getDoc(settingsRef);
      const settings = settingsSnapshot.data() ?? {};
      if (
        (settings.categorySchemaVersion ?? 0) >= 1 ||
        (settings.dataSchemaVersion ?? 0) >= 2
      ) {
        return;
      }

      const transactionsRef = userCollectionRef(
        user.uid,
        "transactions",
      );
      const transactionSnapshot = await getDocs(query(transactionsRef));
      const transactionsNeedingCategoryId = transactionSnapshot.docs
        .map(
          (snapshot) =>
            ({
              ...snapshot.data(),
              id: snapshot.id,
            }) as Transaction,
        )
        .filter(
          (transaction) =>
            !transaction.categoryId && transaction.category,
        );

      let updatedCount = 0;
      for (const transactionChunk of chunkArray(
        transactionsNeedingCategoryId,
        450,
      )) {
        const batch = writeBatch(db);
        let chunkWrites = 0;
        for (const transaction of transactionChunk) {
          const matched = findCategoryByPath(
            transaction.category,
            categories,
            transaction.type,
          );
          if (!matched) continue;
          batch.update(doc(transactionsRef, transaction.id), {
            categoryId: matched.id,
          });
          updatedCount += 1;
          chunkWrites += 1;
        }
        if (chunkWrites > 0) await batch.commit();
      }

      await setDoc(
        settingsRef,
        { categorySchemaVersion: 1 },
        { merge: true },
      );
      console.info(
        `Category migration complete: ${updatedCount} transactions updated.`,
      );
    };

    void migrateCategoryIds().catch((migrationError) => {
      migrationUserRef.current = null;
      console.error(
        "Error migrating categoryId for transactions:",
        migrationError,
      );
    });
  }, [categories, loading, user]);

  const addCategory = useCallback(
    async (category: Omit<Category, "id">): Promise<Category> => {
      if (!collectionRef) throw new Error("User not authenticated");
      const newDocumentRef = doc(collectionRef);
      const newCategory = { ...category, id: newDocumentRef.id };
      await setDoc(newDocumentRef, newCategory);
      return newCategory;
    },
    [collectionRef],
  );

  const updateCategory = useCallback(
    async (id: string, _oldName: string, newName: string) => {
      if (!collectionRef || !user) return;
      const categoryDocumentRef = doc(collectionRef, id);
      const categorySnapshot = await getDoc(categoryDocumentRef);
      if (!categorySnapshot.exists()) return;

      await setDoc(
        categoryDocumentRef,
        { name: newName },
        { merge: true },
      );

      const transactionsRef = userCollectionRef(
        user.uid,
        "transactions",
      );
      const transactionSnapshot = await getDocs(
        query(transactionsRef, where("categoryId", "==", id)),
      );
      const updatedLabel =
        buildCategoryPathLabel(id, categories, newName) ?? newName;
      await updateTransactionCategoryLabels(
        transactionSnapshot.docs,
        updatedLabel,
      );
    },
    [categories, collectionRef, user],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      if (!collectionRef) return;
      await deleteDoc(doc(collectionRef, id));
    },
    [collectionRef],
  );

  const addSubCategory = useCallback(
    async (
      parentId: string,
      subCategory: Omit<SubCategory, "id">,
      parentPath: string[] = [],
    ): Promise<SubCategory> => {
      if (!collectionRef) throw new Error("User not authenticated");
      const categoryDocumentRef = doc(collectionRef, parentId);
      const newId = `sub_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 11)}`;
      const newSubCategory: SubCategory = {
        ...subCategory,
        id: newId,
        subCategories: [],
      };

      const parentDocument = await getDoc(categoryDocumentRef);
      if (!parentDocument.exists()) return newSubCategory;
      const data = parentDocument.data();

      const addNested = (
        items: SubCategory[],
        path: string[],
      ): SubCategory[] => {
        if (path.length === 0) return [...items, newSubCategory];
        const [currentId, ...remainingPath] = path;
        return items.map((item) =>
          item.id === currentId
            ? {
                ...item,
                subCategories: addNested(
                  item.subCategories ?? [],
                  remainingPath,
                ),
              }
            : item,
        );
      };

      const targetPath =
        parentPath[0] === parentId
          ? parentPath.slice(1)
          : parentPath;
      const subCategories =
        targetPath.length > 0
          ? addNested(data.subCategories ?? [], targetPath)
          : [...(data.subCategories ?? []), newSubCategory];
      await setDoc(
        categoryDocumentRef,
        { subCategories },
        { merge: true },
      );
      return newSubCategory;
    },
    [collectionRef],
  );

  const updateSubCategory = useCallback(
    async (
      categoryId: string,
      subCategoryId: string,
      _oldName: string,
      newName: string,
      parentPath: string[] = [],
    ) => {
      if (!collectionRef || !user) return;
      const categoryDocumentRef = doc(collectionRef, categoryId);
      const parentDocument = await getDoc(categoryDocumentRef);
      if (parentDocument.exists()) {
        const updateNested = (
          items: SubCategory[],
          path: string[],
        ): SubCategory[] => {
          const [currentId, ...remainingPath] = path;
          if (remainingPath.length === 0) {
            return items.map((item) =>
              item.id === currentId
                ? { ...item, name: newName }
                : item,
            );
          }
          return items.map((item) =>
            item.id === currentId
              ? {
                  ...item,
                  subCategories: updateNested(
                    item.subCategories ?? [],
                    remainingPath,
                  ),
                }
              : item,
          );
        };

        const updatedSubCategories = updateNested(
          parentDocument.data().subCategories ?? [],
          [...parentPath, subCategoryId],
        );
        await setDoc(
          categoryDocumentRef,
          { subCategories: updatedSubCategories },
          { merge: true },
        );
      }

      const transactionsRef = userCollectionRef(
        user.uid,
        "transactions",
      );
      const transactionSnapshot = await getDocs(
        query(
          transactionsRef,
          where("categoryId", "==", subCategoryId),
        ),
      );
      const updatedLabel =
        buildCategoryPathLabel(
          subCategoryId,
          categories,
          newName,
        ) ?? newName;
      await updateTransactionCategoryLabels(
        transactionSnapshot.docs,
        updatedLabel,
      );
    },
    [categories, collectionRef, user],
  );

  const deleteSubCategory = useCallback(
    async (
      categoryId: string,
      subCategoryId: string,
      parentPath: string[] = [],
    ) => {
      if (!collectionRef) return;
      const categoryDocumentRef = doc(collectionRef, categoryId);
      const parentDocument = await getDoc(categoryDocumentRef);
      if (!parentDocument.exists()) return;

      const deleteNested = (
        items: SubCategory[],
        path: string[],
      ): SubCategory[] => {
        const [currentId, ...remainingPath] = path;
        if (remainingPath.length === 0) {
          return items.filter((item) => item.id !== currentId);
        }
        return items.map((item) =>
          item.id === currentId
            ? {
                ...item,
                subCategories: deleteNested(
                  item.subCategories ?? [],
                  remainingPath,
                ),
              }
            : item,
        );
      };

      await setDoc(
        categoryDocumentRef,
        {
          subCategories: deleteNested(
            parentDocument.data().subCategories ?? [],
            [...parentPath, subCategoryId],
          ),
        },
        { merge: true },
      );
    },
    [collectionRef],
  );

  const importCategories = useCallback(
    async (
      importedData: {
        name: string;
        type: "income" | "expense";
        parent_name: string;
      }[],
    ) => {
      if (!collectionRef) throw new Error("User not authenticated");
      const existingCategories: CategoryTreeItem[] = [
        ...categories,
      ];

      const findByName = (
        name: string,
        items: CategoryTreeItem[],
      ): CategoryTreeItem | undefined => {
        for (const item of items) {
          if (item.name.toLowerCase() === name.toLowerCase()) {
            return item;
          }
          const nested = item.subCategories
            ? findByName(name, item.subCategories)
            : undefined;
          if (nested) return nested;
        }
        return undefined;
      };

      const rootWrites = importedData
        .filter(
          (item) =>
            !item.parent_name &&
            !findByName(item.name, existingCategories),
        )
        .map((item) => {
          const newDocumentRef = doc(collectionRef);
          const category: Category = {
            id: newDocumentRef.id,
            name: item.name,
            type: item.type,
            icon: "Sparkles",
            subCategories: [],
          };
          existingCategories.push(category);
          return { newDocumentRef, category };
        });

      for (const writeChunk of chunkArray(rootWrites, 450)) {
        const batch = writeBatch(db);
        writeChunk.forEach(({ newDocumentRef, category }) => {
          batch.set(newDocumentRef, category);
        });
        await batch.commit();
      }

      for (const item of importedData.filter(
        (candidate) => candidate.parent_name,
      )) {
        if (findByName(item.name, existingCategories)) continue;
        const parent = findByName(
          item.parent_name,
          existingCategories,
        ) as Category | undefined;
        if (!parent?.type) continue;
        const newSubCategory = await addSubCategory(parent.id, {
          name: item.name,
          icon: "Sparkles",
        });
        parent.subCategories = [
          ...(parent.subCategories ?? []),
          newSubCategory,
        ];
      }
    },
    [addSubCategory, categories, collectionRef],
  );

  const value = useMemo<CategoriesContextType>(
    () => ({
      categories,
      loading,
      error,
      addCategory,
      addSubCategory,
      updateCategory,
      deleteCategory,
      updateSubCategory,
      deleteSubCategory,
      importCategories,
    }),
    [
      addCategory,
      addSubCategory,
      categories,
      deleteCategory,
      deleteSubCategory,
      error,
      importCategories,
      loading,
      updateCategory,
      updateSubCategory,
    ],
  );

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories(): CategoriesContextType {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error(
      "useCategories must be used within CategoriesProvider",
    );
  }
  return context;
}
