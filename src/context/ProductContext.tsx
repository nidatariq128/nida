import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { Product, CollectionItem } from '../types';
import { INITIAL_PRODUCTS, CATEGORIES_LIST } from '../data/sampleProducts';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';

const DEFAULT_COLLECTIONS: CollectionItem[] = CATEGORIES_LIST.map((c, i) => ({
  id: `cat-default-${i}`,
  name: c.name,
  description: c.description,
  image: c.image,
  tagline: c.tagline,
  isCustom: false,
}));

interface ProductContextType {
  products: Product[];
  categories: CollectionItem[];
  loading: boolean;
  selectedCategory: string | null;
  setSelectedCategory: (cat: string | null) => void;
  selectedProductForModal: Product | null;
  setSelectedProductForModal: (product: Product | null) => void;
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Promise<string>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addCollection: (col: Omit<CollectionItem, 'id' | 'isCustom' | 'createdAt'>) => Promise<string>;
  updateCollection: (id: string, updates: Partial<CollectionItem>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  seedInitialData: () => Promise<number>;
  getProductById: (id: string) => Product | undefined;
  applyStockUpdates: (stockMap: Record<string, number>) => void;
  syncPendingStockToFirestore: () => Promise<number>;
  refreshCatalog: () => Promise<void>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

const getDeletedProductIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem('zn_deleted_product_ids');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const getDeletedCollectionIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem('zn_deleted_collection_ids');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const BROKEN_IMAGE_TOKEN = '1611591475878-c07a33e459db';

const sanitizeProductImages = (product: Product): Product => {
  if (!Array.isArray(product.images) || product.images.length === 0) {
    return product;
  }
  const hasBroken = product.images.some(
    (url) => typeof url === 'string' && url.includes(BROKEN_IMAGE_TOKEN)
  );
  if (!hasBroken) return product;
  const fallback =
    String(product.category || '').toLowerCase().includes('bangle')
      ? '/hero-bangles.jpg'
      : '/hero-steel.jpg';
  return {
    ...product,
    images: product.images.map((url) =>
      typeof url === 'string' && url.includes(BROKEN_IMAGE_TOKEN) ? fallback : url
    ),
  };
};

const applyServerDeltas = (
  items: Product[],
  pendingDeltas: Record<string, number>
): Product[] => {
  if (!pendingDeltas || Object.keys(pendingDeltas).length === 0) {
    return items.map(sanitizeProductImages);
  }
  return items.map((p) => {
    const clean = sanitizeProductImages(p);
    const delta = pendingDeltas[clean.id];
    if (typeof delta === 'number' && delta !== 0) {
      return { ...clean, stock: Math.max(0, (Number(clean.stock) || 0) + delta) };
    }
    return clean;
  });
};

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin } = useAuth();
  const autoSeededRef = useRef(false);

  const isExcludedItem = (p: { id?: string; name?: string; category?: string; price?: number }) => {
    if (p.id && getDeletedProductIds().has(p.id)) return true;
    const forbiddenCats = ['Gold Jewellery', 'Diamond Jewellery', 'Customised Nikkah Essentials'];
    const forbiddenWords = [
      '22K Gold',
      '21K Gold',
      'Royal Gold Choker',
      'Emerald-Cut Diamond',
      'Marquise Diamond',
      'Solitaire Diamond',
      'Tennis Bracelet',
      'nikkah',
      'nikah',
    ];
    if (p.price && p.price > 150000) return true;
    if (p.category && forbiddenCats.includes(p.category)) return true;
    if (p.name && forbiddenWords.some((w) => p.name!.toLowerCase().includes(w.toLowerCase()))) return true;
    return false;
  };

  const [products, setProducts] = useState<Product[]>(() => {
    const deletedIds = getDeletedProductIds();
    return INITIAL_PRODUCTS.filter((p) => !deletedIds.has(p.id)).map(sanitizeProductImages);
  });

  const [customCollections, setCustomCollections] = useState<CollectionItem[]>([]);
  const [serverDeletedCols, setServerDeletedCols] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);

  const buildMergedFallbackCatalog = useCallback(async (deletedIds: Set<string>): Promise<Product[]> => {
    const merged = new Map<string, Product>();
    for (const p of INITIAL_PRODUCTS) {
      if (!deletedIds.has(p.id)) merged.set(p.id, p);
    }
    try {
      const bakRes = await fetch('/api/catalog/migrated-products');
      if (bakRes.ok) {
        const bakData = await bakRes.json();
        if (Array.isArray(bakData?.products)) {
          for (const bp of bakData.products as Product[]) {
            if (bp?.id && !isExcludedItem(bp) && !deletedIds.has(bp.id)) {
              merged.set(bp.id, bp);
            }
          }
        }
      }
    } catch {
      // Fallback to INITIAL_PRODUCTS only
    }
    return Array.from(merged.values());
  }, []);

  const fetchProductsAndCollections = useCallback(async () => {
    const deletedIds = getDeletedProductIds();
    const deletedCols = getDeletedCollectionIds();

    let serverDeltas: Record<string, number> = {};
    let serverProducts: Product[] = [];
    let serverCustomCollections: CollectionItem[] = [];

    try {
      const liveRes = await fetch('/api/catalog/live');
      if (liveRes.ok) {
        const liveData = await liveRes.json();
        if (Array.isArray(liveData?.deletedProductIds)) {
          for (const did of liveData.deletedProductIds as string[]) deletedIds.add(did);
        }
        if (Array.isArray(liveData?.deletedCollectionIds)) {
          setServerDeletedCols(liveData.deletedCollectionIds as string[]);
          for (const dcid of liveData.deletedCollectionIds as string[]) deletedCols.add(dcid);
        }
        if (Array.isArray(liveData?.products)) {
          serverProducts = (liveData.products as Product[])
            .filter((p) => p?.id && !isExcludedItem(p) && !deletedIds.has(p.id))
            .map(sanitizeProductImages);
        }
        if (Array.isArray(liveData?.customCollections)) {
          serverCustomCollections = (liveData.customCollections as CollectionItem[]).filter(
            (c) => c?.id && !deletedCols.has(c.id) && !deletedCols.has(c.name)
          );
        }
        if (liveData?.pendingDeltas && typeof liveData.pendingDeltas === 'object') {
          serverDeltas = liveData.pendingDeltas;
        }
      }
    } catch {
      // Offline fallback continues below
    }

    try {
      const colRef = collection(db, 'products');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const mergedMap = new Map<string, Product>();
        for (const sp of serverProducts) {
          mergedMap.set(sp.id, sanitizeProductImages(sp));
        }
        snap.forEach((d) => {
          const item = sanitizeProductImages({ id: d.id, ...d.data() } as Product);
          if (!isExcludedItem(item) && !deletedIds.has(item.id)) {
            const existingServer = mergedMap.get(item.id);
            if (!existingServer) {
              mergedMap.set(item.id, item);
            } else {
              const delta = serverDeltas[item.id] || 0;
              mergedMap.set(item.id, {
                ...item,
                ...existingServer,
                images: existingServer.images?.length ? existingServer.images : item.images,
                stock: existingServer.stock ?? Math.max(0, (Number(item.stock) || 0) + delta),
              });
            }
          }
        });

        const list = Array.from(mergedMap.values()).map(sanitizeProductImages);
        if (list.length > 0) {
          setProducts(list);
        } else {
          const fallback = await buildMergedFallbackCatalog(deletedIds);
          setProducts(applyServerDeltas(fallback, serverDeltas));
        }
      } else if (serverProducts.length > 0) {
        setProducts(serverProducts.map(sanitizeProductImages));
      } else {
        const fallback = await buildMergedFallbackCatalog(deletedIds);
        setProducts(applyServerDeltas(fallback, serverDeltas));
      }

      try {
        const colsSnap = await getDocs(collection(db, 'collections'));
        const colMap = new Map<string, CollectionItem>();
        for (const sc of serverCustomCollections) {
          colMap.set(sc.id, sc);
        }
        if (!colsSnap.empty) {
          colsSnap.forEach((d) => {
            const colItem = { id: d.id, ...d.data() } as CollectionItem;
            if (!deletedCols.has(colItem.id) && !deletedCols.has(colItem.name)) {
              colMap.set(colItem.id, colItem);
            }
          });
        }
        setCustomCollections(Array.from(colMap.values()));
      } catch (err) {
        console.warn('Could not read custom collections from Firestore:', err);
        if (serverCustomCollections.length > 0) {
          setCustomCollections(serverCustomCollections);
        }
      }
    } catch (err) {
      console.warn('Could not read from Firestore products collection, using persistent server catalogue:', err);
      if (serverProducts.length > 0) {
        setProducts(serverProducts.map(sanitizeProductImages));
        setCustomCollections(serverCustomCollections);
      } else {
        const fallback = await buildMergedFallbackCatalog(deletedIds);
        setProducts(applyServerDeltas(fallback, serverDeltas));
      }
    } finally {
      setLoading(false);
    }
  }, [buildMergedFallbackCatalog]);

  useEffect(() => {
    fetchProductsAndCollections();
  }, [fetchProductsAndCollections]);

  const applyStockUpdates = useCallback((stockMap: Record<string, number>) => {
    if (!stockMap || Object.keys(stockMap).length === 0) return;
    setProducts((prev) =>
      prev.map((p) =>
        typeof stockMap[p.id] === 'number'
          ? { ...p, stock: Math.max(0, stockMap[p.id]) }
          : p
      )
    );
    setSelectedProductForModal((prev) =>
      prev && typeof stockMap[prev.id] === 'number'
        ? { ...prev, stock: Math.max(0, stockMap[prev.id]) }
        : prev
    );
  }, []);

  const syncPendingStockToFirestore = useCallback(async (): Promise<number> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return 0;

    try {
      const stateRes = await fetch('/api/catalog/stock-state');
      if (!stateRes.ok) return 0;
      const stateData = await stateRes.json();
      const deltas = stateData?.pendingDeltas as Record<string, number> | undefined;
      if (!deltas || Object.keys(deltas).length === 0) return 0;

      const snap = await getDocs(collection(db, 'products'));
      const firestoreById = new Map<string, Product>();
      snap.forEach((d) => firestoreById.set(d.id, { id: d.id, ...d.data() } as Product));

      const syncedIds: string[] = [];
      for (const [pid, delta] of Object.entries(deltas)) {
        if (typeof delta !== 'number' || delta === 0) continue;
        const baseProd =
          firestoreById.get(pid) || INITIAL_PRODUCTS.find((p) => p.id === pid);
        if (!baseProd) continue;

        const nextStock = Math.max(0, (Number(baseProd.stock) || 0) + delta);
        const cleanDoc: Record<string, unknown> = {};
        for (const [k, v] of Object.entries({ ...baseProd, stock: nextStock })) {
          if (v !== undefined) cleanDoc[k] = v;
        }
        await setDoc(doc(db, 'products', pid), cleanDoc, { merge: true });
        syncedIds.push(pid);
      }

      if (syncedIds.length > 0) {
        const idToken = await currentUser.getIdToken();
        await fetch('/api/admin/inventory/mark-synced', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ productIds: syncedIds }),
        });
        await fetchProductsAndCollections();
      }
      return syncedIds.length;
    } catch (err) {
      console.warn('Stock sync check note:', err);
      return 0;
    }
  }, [fetchProductsAndCollections]);

  const seedInitialData = useCallback(async (): Promise<number> => {
    try {
      localStorage.removeItem('zn_deleted_product_ids');
      localStorage.removeItem('zn_deleted_collection_ids');
    } catch {}

    let count = 0;
    try {
      const seedMap = new Map<string, Product>();
      for (const item of INITIAL_PRODUCTS) {
        seedMap.set(item.id, item);
      }
      try {
        const bakRes = await fetch('/api/catalog/migrated-products');
        if (bakRes.ok) {
          const bakData = await bakRes.json();
          if (Array.isArray(bakData?.products)) {
            for (const bp of bakData.products as Product[]) {
              if (bp?.id && !isExcludedItem(bp)) {
                seedMap.set(bp.id, bp);
              }
            }
          }
        }
      } catch {}

      for (const item of seedMap.values()) {
        const cleanItem: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(item)) {
          if (v !== undefined) cleanItem[k] = v;
        }
        await setDoc(doc(db, 'products', item.id), cleanItem, { merge: true });
        count++;
      }
      await fetchProductsAndCollections();
      return count;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'products');
    }
  }, [fetchProductsAndCollections]);

  // Automatic Hands-Free Firestore Initialization & Stock Sync on Owner Login
  useEffect(() => {
    if (!user || !isAdmin || autoSeededRef.current) return;
    autoSeededRef.current = true;

    (async () => {
      try {
        const snap = await getDocs(collection(db, 'products'));
        if (snap.empty) {
          await seedInitialData();
        }
        await syncPendingStockToFirestore();
      } catch (err) {
        console.warn('Automatic Firestore sync check:', err);
      }
    })();
  }, [user, isAdmin, seedInitialData, syncPendingStockToFirestore]);

  const persistProductToServer = async (prod: Product) => {
    if (!auth.currentUser) return;
    try {
      const idToken = await auth.currentUser.getIdToken();
      await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ product: prod }),
      });
    } catch (err) {
      console.warn('Server product persistence note:', err);
    }
  };

  const addProduct = async (prodData: Omit<Product, 'id' | 'createdAt'>): Promise<string> => {
    const id = `zn-prod-${Date.now()}`;
    const newProduct: Product = {
      ...prodData,
      id,
      createdAt: new Date().toISOString(),
    };

    const cleanProduct: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(newProduct)) {
      if (v !== undefined) {
        cleanProduct[k] = v;
      }
    }

    try {
      await setDoc(doc(db, 'products', id), cleanProduct);
      await persistProductToServer(newProduct);
      setProducts((prev) => [newProduct, ...prev]);
      return id;
    } catch (error) {
      await persistProductToServer(newProduct);
      setProducts((prev) => [newProduct, ...prev]);
      handleFirestoreError(error, OperationType.CREATE, `products/${id}`);
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const existingProduct = products.find((p) => p.id === id);
    const mergedProduct = existingProduct ? { ...existingProduct, ...updates } : ({ id, ...updates } as Product);
    const cleanUpdates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(mergedProduct)) {
      if (v !== undefined) {
        cleanUpdates[k] = v;
      }
    }

    try {
      await setDoc(doc(db, 'products', id), cleanUpdates, { merge: true });
      await persistProductToServer(mergedProduct);
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
      setSelectedProductForModal((prev) =>
        prev && prev.id === id ? { ...prev, ...updates } : prev
      );
    } catch (error) {
      await persistProductToServer(mergedProduct);
      handleFirestoreError(error, OperationType.UPDATE, `products/${id}`);
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
      if (auth.currentUser) {
        try {
          const idToken = await auth.currentUser.getIdToken();
          await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${idToken}` },
          });
        } catch {}
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
      try {
        const deletedIds = getDeletedProductIds();
        deletedIds.add(id);
        localStorage.setItem('zn_deleted_product_ids', JSON.stringify(Array.from(deletedIds)));
      } catch {}
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
    }
  };

  const addCollection = async (
    colData: Omit<CollectionItem, 'id' | 'isCustom' | 'createdAt'>
  ): Promise<string> => {
    const id = `col-${Date.now()}`;
    const newCol: CollectionItem = {
      ...colData,
      id,
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'collections', id), newCol);
      if (auth.currentUser) {
        try {
          const idToken = await auth.currentUser.getIdToken();
          await fetch('/api/admin/collections', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ collection: newCol }),
          });
        } catch {}
      }
      setCustomCollections((prev) => [...prev, newCol]);
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `collections/${id}`);
    }
  };

  const deleteCollection = async (idOrName: string) => {
    try {
      await deleteDoc(doc(db, 'collections', idOrName));
      if (auth.currentUser) {
        try {
          const idToken = await auth.currentUser.getIdToken();
          await fetch(`/api/admin/collections/${encodeURIComponent(idOrName)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${idToken}` },
          });
        } catch {}
      }
      setCustomCollections((prev) =>
        prev.filter((c) => c.id !== idOrName && c.name !== idOrName)
      );
      try {
        const deletedCols = getDeletedCollectionIds();
        deletedCols.add(idOrName);
        localStorage.setItem(
          'zn_deleted_collection_ids',
          JSON.stringify(Array.from(deletedCols))
        );
      } catch {}
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `collections/${idOrName}`);
    }
  };

  const getProductById = (id: string) => products.find((p) => p.id === id);

  const deletedCols = new Set([...Array.from(getDeletedCollectionIds()), ...serverDeletedCols]);

  const overrideById = new Map<string, CollectionItem>();
  const overrideByName = new Map<string, CollectionItem>();
  for (const cc of customCollections) {
    if (cc?.id) overrideById.set(cc.id, cc);
    if (cc?.name) overrideByName.set(cc.name, cc);
  }
  const mergedDefaults = DEFAULT_COLLECTIONS.map((dc) => {
    const ov = overrideById.get(dc.id) || overrideByName.get(dc.name);
    if (!ov) return dc;
    return {
      ...dc,
      ...ov,
      id: dc.id,
      name: dc.name,
      isCustom: false,
    };
  });
  const pureCustom = customCollections.filter(
    (cc) => !DEFAULT_COLLECTIONS.some((dc) => dc.id === cc.id || dc.name === cc.name)
  );
  const allCategories: CollectionItem[] = [...mergedDefaults, ...pureCustom].filter(
    (c) => !deletedCols.has(c.id) && !deletedCols.has(c.name)
  );

  const updateCollection = async (id: string, updates: Partial<CollectionItem>) => {
    const existingCol =
      allCategories.find((c) => c.id === id) ||
      DEFAULT_COLLECTIONS.find((c) => c.id === id);
    if (!existingCol) {
      throw new Error('Collection not found.');
    }

    const updatedCol: CollectionItem = {
      id: existingCol.id,
      name: updates.name?.trim() || existingCol.name,
      tagline: updates.tagline !== undefined ? updates.tagline : existingCol.tagline,
      description: updates.description !== undefined ? updates.description : existingCol.description,
      image: updates.image !== undefined ? updates.image : existingCol.image,
      isCustom: existingCol.isCustom,
      ...(existingCol.createdAt ? { createdAt: existingCol.createdAt } : {}),
    };

    const cleanDoc: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updatedCol)) {
      if (v !== undefined) cleanDoc[k] = v;
    }

    try {
      await setDoc(doc(db, 'collections', updatedCol.id), cleanDoc, { merge: true });
      if (auth.currentUser) {
        try {
          const idToken = await auth.currentUser.getIdToken();
          await fetch('/api/admin/collections', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ collection: updatedCol }),
          });
        } catch {}
      }
      setCustomCollections((prev) => [
        ...prev.filter((c) => c.id !== updatedCol.id && c.name !== updatedCol.name),
        updatedCol,
      ]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `collections/${updatedCol.id}`);
    }
  };

  return (
    <ProductContext.Provider
      value={{
        products,
        categories: allCategories,
        loading,
        selectedCategory,
        setSelectedCategory,
        selectedProductForModal,
        setSelectedProductForModal,
        addProduct,
        updateProduct,
        deleteProduct,
        addCollection,
        updateCollection,
        deleteCollection,
        seedInitialData,
        getProductById,
        applyStockUpdates,
        syncPendingStockToFirestore,
        refreshCatalog: fetchProductsAndCollections,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProducts must be used within a ProductProvider');
  }
  return context;
};
