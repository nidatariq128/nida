import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit3, 
  Package, 
  ShoppingBag, 
  Users, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Truck, 
  Settings as SettingsIcon, 
  Database,
  ArrowRight,
  Save,
  Search,
  Upload,
  Camera,
  Image as ImageIcon,
  MessageCircle,
  Copy,
  Check,
  FileText,
  Printer,
  ExternalLink,
  Bell,
  Send,
  QrCode,
  RefreshCw,
  LayoutDashboard,
  Layers,
  LogOut
} from 'lucide-react';
import { useProducts } from '../../context/ProductContext';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, updateDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product, Order, OrderStatus, ProductCategory, InventoryLog } from '../../types';
import { formatPKR, formatDate, generateSKU } from '../../lib/formatters';
import { useStoreSettings } from '../../context/StoreSettingsContext';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const {
    products,
    categories,
    addProduct,
    updateProduct,
    deleteProduct,
    addCollection,
    deleteCollection,
    seedInitialData,
    applyStockUpdates,
    syncPendingStockToFirestore,
  } = useProducts();
  const { isAdmin, user, authError, clearAuthError, loginWithGoogle, logout, refreshSession } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'collections' | 'orders' | 'settings'>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [seedingLoading, setSeedingLoading] = useState(false);
  const [seedSuccessCount, setSeedSuccessCount] = useState<number | null>(null);

  const { settings, updateSettings } = useStoreSettings();
  const [settingsForm, setSettingsForm] = useState(settings);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSavedSuccess, setSettingsSavedSuccess] = useState(false);

  // Custom Collection Form State
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColTagline, setNewColTagline] = useState('');
  const [newColDescription, setNewColDescription] = useState('');
  const [newColImage, setNewColImage] = useState('/hero-steel.jpg');
  const [colSaving, setColSaving] = useState(false);
  const [colSuccessMessage, setColSuccessMessage] = useState<string | null>(null);

  // In-App Deletion Modal State (avoids blocked window.confirm in iframes)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'product' | 'collection';
    id: string;
    name: string;
  } | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  // New / Edit Product Form State
  const [isEditingProduct, setIsEditingProduct] = useState<boolean>(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodCategory, setProdCategory] = useState<ProductCategory>('Watches');
  const [prodPrice, setProdPrice] = useState<number>(7500);
  const [prodSalePrice, setProdSalePrice] = useState<number | undefined>(undefined);
  const [prodGoldPurity, setProdGoldPurity] = useState<string>('Stainless Steel & Mineral Glass');
  const [prodWeight, setProdWeight] = useState<number>(0);
  const [prodDiamondDetails, setProdDiamondDetails] = useState('');
  const [prodStock, setProdStock] = useState<number>(5);
  const [prodDescription, setProdDescription] = useState('');
  const [imageFiles, setImageFiles] = useState<string[]>([
    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1000&q=80'
  ]);
  const [isUploadingImages, setIsUploadingImages] = useState<boolean>(false);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [prodIsFeatured, setProdIsFeatured] = useState<boolean>(true);
  const [prodIsNewArrival, setProdIsNewArrival] = useState<boolean>(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [formValidationError, setFormValidationError] = useState<string | null>(null);
  const [productSavedSuccess, setProductSavedSuccess] = useState<string | null>(null);

  // Order update modal/state
  const [selectedOrderToEdit, setSelectedOrderToEdit] = useState<Order | null>(null);
  const [newOrderStatus, setNewOrderStatus] = useState<OrderStatus>('Confirmed');
  const [newTrackingNumber, setNewTrackingNumber] = useState('');
  const [newPaymentStatus, setNewPaymentStatus] = useState<'pending' | 'paid' | 'failed'>('paid');
  const [verificationNote, setVerificationNote] = useState('');
  const [updatingOrder, setUpdatingOrder] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [prodSearchQuery, setProdSearchQuery] = useState('');
  const [prodCategoryFilter, setProdCategoryFilter] = useState<string>('ALL');
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [customerWaQuickAlert, setCustomerWaQuickAlert] = useState<{
    orderNumber: string;
    customerName: string;
    orderStatus: string;
    url: string;
  } | null>(null);

  // Automatic WhatsApp Alert Config (Stored privately on server ledger, never public Firestore)
  const [alertStatus, setAlertStatus] = useState<{
    configured: boolean;
    activeProvider: string;
    ownerWhatsappPhone: string;
    directWa?: {
      status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
      qrDataUrl: string | null;
      connectedPhone: string | null;
      connectedName: string | null;
      lastError: string | null;
    };
    hasCallMeBotKey: boolean;
    callMeBotKeyMasked: string;
    hasTextMeBotKey: boolean;
    textMeBotKeyMasked: string;
    hasWebhookUrl: boolean;
    webhookMasked: string;
  } | null>(null);
  const [alertOwnerPhone, setAlertOwnerPhone] = useState('+92 317 8113817');
  const [alertCallMeBotKey, setAlertCallMeBotKey] = useState('');
  const [alertTextMeBotKey, setAlertTextMeBotKey] = useState('');
  const [alertWebhookUrl, setAlertWebhookUrl] = useState('');
  const [alertSaving, setAlertSaving] = useState(false);
  const [alertTesting, setAlertTesting] = useState(false);
  const [waConnecting, setWaConnecting] = useState(false);
  const [alertFeedback, setAlertFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchAlertConfig = async () => {
    if (!user || !isAdmin) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/alerts/config', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAlertStatus(data);
        if (data?.ownerWhatsappPhone) {
          setAlertOwnerPhone(
            data.ownerWhatsappPhone.startsWith('+')
              ? data.ownerWhatsappPhone
              : `+${data.ownerWhatsappPhone}`
          );
        }
      }
    } catch (err) {
      console.warn('Alert config fetch note:', err);
    }
  };

  useEffect(() => {
    if (isOpen && user && isAdmin) {
      (async () => {
        await syncPendingStockToFirestore();
        await fetchOrders();
        await fetchAlertConfig();
      })();
    }
  }, [isOpen, user, isAdmin]);

  // Poll WhatsApp QR connection status every 2s while scanning or connecting
  useEffect(() => {
    const waState = alertStatus?.directWa?.status;
    if (!isOpen || !user || !isAdmin || activeTab !== 'settings') return;
    if (waState !== 'connecting' && waState !== 'qr_ready') return;

    const timer = setInterval(() => {
      fetchAlertConfig();
    }, 2000);
    return () => clearInterval(timer);
  }, [isOpen, user, isAdmin, activeTab, alertStatus?.directWa?.status]);

  const fetchOrders = async () => {
    if (!user || !isAdmin) return;
    setLoadingOrders(true);
    setAdminError(null);
    try {
      const mergedMap = new Map<string, Order>();

      // 1. Fetch from Firestore orders (admin authorized)
      const firestoreOrderNumbers = new Set<string>();
      try {
        const snap = await getDocs(collection(db, 'orders'));
        snap.forEach((d) => {
          const ord = { id: d.id, ...d.data() } as Order;
          const key = ord.orderNumber || ord.id;
          mergedMap.set(key, ord);
          firestoreOrderNumbers.add(key);
        });
      } catch (fsErr) {
        console.warn('Firestore orders read note:', fsErr);
      }

      // 2. Fetch authoritative server ledger orders & inventory audit logs
      try {
        const idToken = await user.getIdToken();
        const apiRes = await fetch('/api/admin/orders', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (apiRes.ok) {
          const data = await apiRes.json();
          if (Array.isArray(data.orders)) {
            for (const ord of data.orders as Order[]) {
              const key = ord.orderNumber || ord.id;
              const existing = mergedMap.get(key);
              if (!existing) {
                mergedMap.set(key, ord);
              } else {
                const existingTime = new Date(existing.updatedAt || existing.createdAt).getTime();
                const serverTime = new Date(ord.updatedAt || ord.createdAt).getTime();
                if (serverTime >= existingTime) {
                  mergedMap.set(key, { ...existing, ...ord });
                }
              }

              // Automatically mirror server orders missing from Firestore
              if (key && !firestoreOrderNumbers.has(key)) {
                try {
                  const cleanOrd: Record<string, unknown> = {};
                  for (const [k, v] of Object.entries(ord)) {
                    if (v !== undefined) cleanOrd[k] = v;
                  }
                  await setDoc(doc(db, 'orders', key), cleanOrd, { merge: true });
                } catch {
                  // Continue seamlessly if offline or optional fields differ
                }
              }
            }
          }
          if (Array.isArray(data.inventoryLogs)) {
            setInventoryLogs(data.inventoryLogs);
          }
        }
      } catch (apiErr) {
        console.warn('Server admin orders fetch note:', apiErr);
      }

      // 3. Merge any browser-local fallback orders
      try {
        const local = JSON.parse(localStorage.getItem('zn_orders') || '[]');
        if (Array.isArray(local)) {
          for (const ord of local as Order[]) {
            const key = ord.orderNumber || ord.id;
            if (key && !mergedMap.has(key)) {
              mergedMap.set(key, ord);
            }
          }
        }
      } catch (e) {
        console.warn('Local storage orders read note:', e);
      }

      const sorted = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOrders(sorted);
    } catch (err: any) {
      console.warn('Orders read note:', err);
      setAdminError(err?.message || 'Could not load all orders.');
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleSeedDatabase = async () => {
    setSeedingLoading(true);
    setAdminError(null);
    try {
      const count = await seedInitialData();
      setSeedSuccessCount(count);
      setTimeout(() => setSeedSuccessCount(null), 4000);
    } catch (err: any) {
      console.error(err);
      setAdminError(err?.message || 'Unable to seed Firestore database. Verify admin authorization.');
    } finally {
      setSeedingLoading(false);
    }
  };

  // Device image file compressor
  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = Math.round(width);
          canvas.height = Math.round(height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(readerEvent.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
        img.src = readerEvent.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleDeviceFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImages(true);
    try {
      const promises = Array.from(files).map((file) => compressImageFile(file));
      const compressedDataUrls = await Promise.all(promises);
      setImageFiles((prev) => [...prev, ...compressedDataUrls]);
    } catch (err) {
      console.error('File compression error', err);
      setFormValidationError('Could not process some images from your device. Please try again.');
    } finally {
      setIsUploadingImages(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImageFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSetPrimaryImage = (index: number) => {
    if (index === 0) return;
    setImageFiles((prev) => {
      const target = prev[index];
      const rest = prev.filter((_, idx) => idx !== index);
      return [target, ...rest];
    });
  };

  const handleAddUrlImage = () => {
    const trimmed = customUrlInput.trim();
    if (trimmed && !imageFiles.includes(trimmed)) {
      setImageFiles((prev) => [...prev, trimmed]);
      setCustomUrlInput('');
    }
  };

  const categoryPresets: Record<string, string[]> = {
    'Watches': [
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1000&q=80'
    ],
    'Handbags': [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=1000&q=80'
    ],
    'Bangles': [
      '/hero-bangles.jpg',
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=1000&q=80'
    ],
    'Stainless Steel Jewellery': [
      '/hero-steel.jpg',
      'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?auto=format&fit=crop&w=1000&q=80'
    ]
  };

  const handleApplyCategoryPreset = () => {
    const presets = categoryPresets[prodCategory] || categoryPresets['Watches'];
    const nextPreset = presets.find((url) => !imageFiles.includes(url)) || presets[0];
    if (!imageFiles.includes(nextPreset)) {
      setImageFiles((prev) => [...prev, nextPreset]);
    }
  };

  const handleOpenNewProduct = () => {
    setIsEditingProduct(true);
    setEditingProductId(null);
    setFormValidationError(null);
    setProdName('');
    setProdSku(generateSKU('Watches'));
    setProdCategory('Watches');
    setProdPrice(7500);
    setProdSalePrice(undefined);
    setProdGoldPurity('Stainless Steel & Mineral Glass');
    setProdWeight(0);
    setProdDiamondDetails('');
    setProdStock(10);
    setProdDescription('Curated luxury timepiece by ZN JEWELLERS.');
    setImageFiles(['https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=80']);
    setCustomUrlInput('');
    setProdIsFeatured(true);
    setProdIsNewArrival(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    setIsEditingProduct(true);
    setEditingProductId(p.id);
    setFormValidationError(null);
    setProdName(p.name);
    setProdSku(p.sku);
    setProdCategory(p.category);
    setProdPrice(p.price);
    setProdSalePrice(p.salePrice);
    setProdGoldPurity(p.material || p.goldPurity || 'Stainless Steel & Mineral Glass');
    setProdWeight(Number((p as any).weightGrams) || 0);
    setProdDiamondDetails(p.customizationNotice || p.diamondDetails || '');
    setProdStock(p.stock);
    setProdDescription(p.description);
    setImageFiles(p.images && p.images.length > 0 ? p.images : []);
    setCustomUrlInput('');
    setProdIsFeatured(!!p.isFeatured);
    setProdIsNewArrival(!!p.isNewArrival);
  };

  const handleSaveProduct = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setFormValidationError(null);

    // 1. Validation check with clear feedback
    const trimmedName = prodName.trim();
    if (!trimmedName) {
      setFormValidationError('Please enter a Product Title / Name.');
      return;
    }

    const numericPrice = Number(prodPrice);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      setFormValidationError('Please enter a valid Price in PKR.');
      return;
    }

    const numericStock = Number(prodStock);
    if (isNaN(numericStock) || numericStock < 0) {
      setFormValidationError('Please enter a valid stock quantity (0 or more).');
      return;
    }

    const finalImages =
      imageFiles.length > 0
        ? imageFiles
        : ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1000&q=80'];

    const approxBytes = JSON.stringify(finalImages).length;
    if (approxBytes > 800000) {
      setFormValidationError(
        'Total image payload is too large for Cloud Firestore (limit 1 MB per product). Please remove or use fewer uploaded photos.'
      );
      return;
    }

    setSavingProduct(true);

    try {
      const existingProd = editingProductId ? products.find((p) => p.id === editingProductId) : undefined;
      const previousStock = existingProd ? existingProd.stock : 0;

      const dataPayload: any = {
        name: trimmedName,
        sku: prodSku.trim() || generateSKU(prodCategory),
        category: prodCategory,
        price: numericPrice,
        images: finalImages,
        description: prodDescription.trim() || `${trimmedName} - Premium creation by ZN JEWELLERS.`,
        material: prodGoldPurity,
        goldPurity: prodGoldPurity,
        weightGrams: Number(prodWeight) || 0,
        stock: numericStock,
        isFeatured: Boolean(prodIsFeatured),
        isNewArrival: Boolean(prodIsNewArrival),
        rating: existingProd?.rating || 5.0,
        reviewsCount: existingProd?.reviewsCount || 1,
      };

      if (prodSalePrice && Number(prodSalePrice) > 0) {
        dataPayload.salePrice = Number(prodSalePrice);
      }

      if (prodDiamondDetails && prodDiamondDetails.trim()) {
        dataPayload.customizationNotice = prodDiamondDetails.trim();
        dataPayload.diamondDetails = prodDiamondDetails.trim();
      }

      if (editingProductId) {
        await updateProduct(editingProductId, dataPayload);
        if (user && previousStock !== numericStock) {
          try {
            const idToken = await user.getIdToken();
            const logRes = await fetch('/api/admin/inventory/log', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                productId: editingProductId,
                productName: trimmedName,
                previousStock,
                newStock: numericStock,
                reason: 'admin_adjustment',
              }),
            });
            if (logRes.ok) {
              const logData = await logRes.json();
              if (logData?.log) {
                setInventoryLogs((prev) => [logData.log, ...prev]);
              }
            }
          } catch {}
        }
        setProductSavedSuccess(`Product "${trimmedName}" updated successfully!`);
      } else {
        const newId = await addProduct(dataPayload);
        if (user) {
          try {
            const idToken = await user.getIdToken();
            const logRes = await fetch('/api/admin/inventory/log', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                productId: newId,
                productName: trimmedName,
                previousStock: 0,
                newStock: numericStock,
                reason: 'admin_adjustment',
              }),
            });
            if (logRes.ok) {
              const logData = await logRes.json();
              if (logData?.log) {
                setInventoryLogs((prev) => [logData.log, ...prev]);
              }
            }
          } catch {}
        }
        setProductSavedSuccess(`Product "${trimmedName}" successfully saved and added to store!`);
      }

      setIsEditingProduct(false);
      setTimeout(() => setProductSavedSuccess(null), 5000);
    } catch (err: any) {
      console.error('Save product error:', err);
      setFormValidationError(err?.message || 'Error saving product. Please check fields and try again.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleUpdateOrderStatus = async () => {
    if (!selectedOrderToEdit || !user || !isAdmin) return;
    setUpdatingOrder(true);
    setAdminError(null);
    const nowIso = new Date().toISOString();
    try {
      let updatedOrderFromServer: Order | null = null;
      let restoredStockMap: Record<string, number> = {};

      // 1. Authoritative server update (validates transition, records audit trail, restores stock once on cancellation)
      const idToken = await user.getIdToken();
      const apiRes = await fetch(`/api/admin/orders/${encodeURIComponent(selectedOrderToEdit.id)}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orderStatus: newOrderStatus,
          paymentStatus: newPaymentStatus,
          trackingNumber: newTrackingNumber.trim(),
          verificationNote: verificationNote.trim() || undefined,
          existingOrder: selectedOrderToEdit,
        }),
      });

      const apiData = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok) {
        throw new Error(apiData?.error || 'Could not update order on server.');
      }

      if (apiData?.order) {
        updatedOrderFromServer = apiData.order as Order;
      }
      if (apiData?.restoredStockMap && typeof apiData.restoredStockMap === 'object') {
        restoredStockMap = apiData.restoredStockMap;
        if (Object.keys(restoredStockMap).length > 0) {
          applyStockUpdates(restoredStockMap);
        }
      }

      const finalUpdatedOrder: Order = updatedOrderFromServer || {
        ...selectedOrderToEdit,
        orderStatus: newOrderStatus,
        trackingNumber: newTrackingNumber.trim() || selectedOrderToEdit.trackingNumber,
        paymentStatus: newPaymentStatus,
        updatedAt: nowIso,
      };

      // 2. Mirror updated order & any stock restoration back into Firestore so client & Firestore match
      if (!apiData?.persistedInFirestore) {
        try {
          const cleanOrder: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(finalUpdatedOrder)) {
            if (v !== undefined) cleanOrder[k] = v;
          }
          await setDoc(doc(db, 'orders', finalUpdatedOrder.id), cleanOrder, { merge: true });

          for (const [pid, newStock] of Object.entries(restoredStockMap)) {
            await updateDoc(doc(db, 'products', pid), { stock: newStock, updatedAt: nowIso });
          }
        } catch (fsErr) {
          console.warn('Firestore order sync note:', fsErr);
        }
      }

      // 3. Update browser cache & UI state
      try {
        const local = JSON.parse(localStorage.getItem('zn_orders') || '[]');
        if (Array.isArray(local)) {
          const updated = local.map((o: any) =>
            o.id === finalUpdatedOrder.id || o.orderNumber === finalUpdatedOrder.orderNumber
              ? finalUpdatedOrder
              : o
          );
          localStorage.setItem('zn_orders', JSON.stringify(updated));
        }
      } catch {}

      setOrders((prev) =>
        prev.map((o) =>
          o.id === finalUpdatedOrder.id || o.orderNumber === finalUpdatedOrder.orderNumber
            ? finalUpdatedOrder
            : o
        )
      );
      if (apiData?.customerNotified) {
        setCustomerWaQuickAlert(null);
      } else if (apiData?.customerWhatsappUrl) {
        setCustomerWaQuickAlert({
          orderNumber: finalUpdatedOrder.orderNumber,
          customerName: finalUpdatedOrder.customerName,
          orderStatus: finalUpdatedOrder.orderStatus,
          url: apiData.customerWhatsappUrl,
        });
      }

      setDeleteFeedback(
        Object.keys(restoredStockMap).length > 0
          ? `Order ${finalUpdatedOrder.orderNumber} cancelled & stock restored.${apiData?.customerNotified ? ' Customer notified on WhatsApp!' : ''}`
          : apiData?.customerNotified
          ? `Order ${finalUpdatedOrder.orderNumber} updated (${finalUpdatedOrder.orderStatus}) & confirmation sent to customer's WhatsApp!`
          : `Order ${finalUpdatedOrder.orderNumber} updated to ${finalUpdatedOrder.orderStatus}.`
      );
      setTimeout(() => setDeleteFeedback(null), 5000);
      setVerificationNote('');
      setSelectedOrderToEdit(null);
      await fetchOrders();
    } catch (err: any) {
      console.error('Update order status error:', err);
      setAdminError(err?.message || 'Failed to update order status.');
    } finally {
      setUpdatingOrder(false);
    }
  };

  // Real KPIs (excluding cancelled orders from revenue; never fallback to fake figures)
  const activeOrders = orders.filter((o) => o.orderStatus !== 'Cancelled');
  const totalRevenue = activeOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const pendingOrders = orders.filter((o) => ['Order Placed', 'Confirmed', 'Processing'].includes(o.orderStatus));
  const paidOrdersCount = activeOrders.filter((o) => o.paymentStatus === 'paid').length;
  const pendingVerifyCount = activeOrders.filter((o) => o.paymentStatus === 'pending').length;

  const inventoryValue = products.reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.stock) || 0), 0);
  const lowStockProducts = products.filter((p) => (Number(p.stock) || 0) <= 2);

  const filteredProducts = products.filter((p) => {
    const matchesCat = prodCategoryFilter === 'ALL' || p.category === prodCategoryFilter;
    if (!matchesCat) return false;
    if (!prodSearchQuery.trim()) return true;
    const q = prodSearchQuery.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.material || p.goldPurity || '').toLowerCase().includes(q)
    );
  });

  const navItems: {
    id: 'overview' | 'products' | 'collections' | 'orders' | 'settings';
    label: string;
    subtitle: string;
    icon: React.ReactNode;
    count?: number;
  }[] = [
    {
      id: 'overview',
      label: 'Overview',
      subtitle: 'Executive Store Pulse & Audit',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'products',
      label: 'Products',
      subtitle: 'Catalogue, Pricing & Stock Control',
      icon: <Package className="w-4 h-4 shrink-0" />,
      count: products.length,
    },
    {
      id: 'collections',
      label: 'Collections',
      subtitle: 'Storefront Categories & Showcase',
      icon: <Layers className="w-4 h-4 shrink-0" />,
      count: categories.length,
    },
    {
      id: 'orders',
      label: 'Orders',
      subtitle: 'Invoices, Receipts & Courier Dispatch',
      icon: <ShoppingBag className="w-4 h-4 shrink-0" />,
      count: orders.length,
    },
    {
      id: 'settings',
      label: 'Store Settings',
      subtitle: 'Contacts, Payments & WhatsApp Alerts',
      icon: <SettingsIcon className="w-4 h-4 shrink-0" />,
    },
  ];

  const activeNavMeta = navItems.find((item) => item.id === activeTab) || navItems[0];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 lg:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-7xl h-[100dvh] sm:h-[92dvh] bg-[#0c0a07] sm:border sm:border-[#2c2315] sm:rounded-xl shadow-2xl overflow-hidden text-white flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {!user || !isAdmin ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Minimal Auth Gate Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-[#211a10] flex items-center justify-between bg-[#0e0b07] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#141009] border border-[#3b2e1b] text-[#D6B16D] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[#D6B16D] font-bold block">
                    ZN JEWELLERS Portal
                  </span>
                  <h2 className="text-sm sm:text-base font-serif font-semibold text-white">
                    Store & Inventory Administration
                  </h2>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close Admin Dashboard"
                className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 sm:p-12 flex-1 flex items-center justify-center">
              <div className="max-w-md w-full p-6 sm:p-8 rounded-xl bg-[#0f0c08] border border-[#2c2315] text-center space-y-5">
                <div className="w-12 h-12 rounded-lg bg-[#16120b] border border-[#D6B16D]/40 text-[#D6B16D] flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>

                {!user ? (
                  <>
                    <div className="space-y-2">
                      <h3 className="text-lg font-serif font-semibold text-white">Administrator Sign-In Required</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Please sign in with an authorized ZN JEWELLERS store owner Google account to access inventory, order management, and store settings.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        clearAuthError();
                        void loginWithGoogle();
                      }}
                      className="w-full py-3 bg-gradient-to-r from-[#D6B16D] to-[#F4E0A5] text-black text-xs font-bold uppercase tracking-wider rounded-lg hover:shadow-lg transition-all cursor-pointer"
                    >
                      Sign In with Google
                    </button>
                    {authError && (
                      <div className="p-3 rounded-lg bg-red-950/70 border border-red-700/60 text-red-200 text-xs text-left leading-relaxed">
                        {authError}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <h3 className="text-lg font-serif font-semibold text-white">Access Restricted</h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Signed in as <strong className="text-white font-mono">{user.email}</strong>. Administrative permissions are verified server-side and restricted to authorized store owners.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={refreshSession}
                        className="flex-1 py-2.5 bg-[#17130a] border border-[#3b2e1b] text-[#D6B16D] text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-[#D6B16D] hover:text-black transition-colors cursor-pointer"
                      >
                        Refresh Session
                      </button>
                      <button
                        type="button"
                        onClick={logout}
                        className="flex-1 py-2.5 bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-semibold uppercase tracking-wider rounded-lg hover:text-white transition-colors cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
            {/* DESKTOP EXECUTIVE LEFT NAVIGATION RAIL */}
            <aside className="hidden lg:flex lg:w-64 shrink-0 flex-col bg-[#080705] border-r border-[#211a10]">
              {/* Brand Workspace Anchor */}
              <div className="px-5 py-4 border-b border-[#1c160e] flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#141009] border border-[#3b2e1b] text-[#D6B16D] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[#D6B16D] font-bold block leading-none">
                    ZN JEWELLERS
                  </span>
                  <span className="text-xs font-serif text-white font-semibold block mt-1 truncate">
                    Management Studio
                  </span>
                </div>
              </div>

              {/* Primary Section Links */}
              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <span className="px-2.5 pb-1.5 block text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-semibold">
                  Workspace
                </span>
                {navItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        if (item.id !== 'products') setIsEditingProduct(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#15110a] text-[#F4E0A5] border border-[#322717] font-semibold'
                          : 'text-neutral-400 hover:text-white hover:bg-[#100d08] border border-transparent'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className={isActive ? 'text-[#D6B16D]' : 'text-neutral-500'}>
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </span>
                      {typeof item.count === 'number' && (
                        <span
                          className={`font-mono tabular-nums text-[11px] ${
                            isActive ? 'text-[#D6B16D]' : 'text-neutral-500'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Sidebar Footer Utilities */}
              <div className="p-3.5 border-t border-[#1c160e] space-y-3 bg-[#090705]">
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="w-full text-left px-3 py-2 rounded-lg bg-[#0f0c08] border border-[#221a10] hover:border-[#3b2e1b] transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-400">
                    <span>WhatsApp Link</span>
                    <span
                      className={
                        alertStatus?.directWa?.status === 'connected' || alertStatus?.configured
                          ? 'text-emerald-400 font-semibold'
                          : 'text-amber-400 font-semibold'
                      }
                    >
                      {alertStatus?.directWa?.status === 'connected'
                        ? 'Live'
                        : alertStatus?.configured
                        ? 'Active'
                        : 'Setup'}
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-300 font-mono truncate block mt-0.5">
                    {alertStatus?.directWa?.connectedPhone || alertStatus?.ownerWhatsappPhone || 'Direct QR Ready'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleSeedDatabase}
                  disabled={seedingLoading}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#141009] border border-[#2d2214] hover:border-[#D6B16D]/60 text-[#D6B16D] text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Database className="w-3.5 h-3.5 shrink-0" />
                  <span>{seedingLoading ? 'Seeding Firestore...' : 'Seed Live Database'}</span>
                </button>

                <div className="pt-2 border-t border-[#1a140c] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold block leading-none">
                      Authorized Admin
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono truncate block mt-1">
                      {user.email}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    title="Sign Out"
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </aside>

            {/* MAIN CONTENT COLUMN */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
              {/* Top Contextual Workspace Bar */}
              <header className="px-4 sm:px-6 py-3 sm:py-3.5 border-b border-[#211a10] bg-[#0e0b07] flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="lg:hidden w-8 h-8 rounded-lg bg-[#15110a] border border-[#3b2e1b] text-[#D6B16D] flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                      <span className="text-[#D6B16D] font-semibold">ZN JEWELLERS</span>
                      <span className="text-neutral-600">/</span>
                      <span className="text-neutral-200 font-semibold">{activeNavMeta.label}</span>
                    </div>
                    <h2 className="text-sm sm:text-base font-serif font-semibold text-white truncate">
                      {activeNavMeta.subtitle}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Contextual Quick Action (Desktop & Mobile) */}
                  {activeTab === 'products' && !isEditingProduct && (
                    <button
                      type="button"
                      onClick={handleOpenNewProduct}
                      className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#D6B16D] hover:bg-[#F4E0A5] text-black text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Product</span>
                    </button>
                  )}
                  {activeTab === 'collections' && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingCollection(!isCreatingCollection)}
                      className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#D6B16D] hover:bg-[#F4E0A5] text-black text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isCreatingCollection ? 'Close Form' : 'New Collection'}</span>
                    </button>
                  )}
                  {activeTab === 'orders' && (
                    <button
                      type="button"
                      onClick={fetchOrders}
                      disabled={loadingOrders}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#15110a] border border-[#2d2214] hover:border-[#D6B16D]/60 text-neutral-200 hover:text-[#D6B16D] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin text-[#D6B16D]' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  )}

                  {/* Mobile Seed Shortcut */}
                  <button
                    type="button"
                    onClick={handleSeedDatabase}
                    disabled={seedingLoading}
                    title="Seed Live Database"
                    className="lg:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#16120b] border border-[#2d2214] text-[#D6B16D] text-[10px] font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{seedingLoading ? 'Seeding...' : 'Seed'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close Admin Dashboard"
                    className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 border border-transparent hover:border-[#261f13] transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </header>

              {/* MOBILE NAVIGATION STRIP (< lg) */}
              <div className="lg:hidden px-3 py-2 bg-[#080705] border-b border-[#1c160e] flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
                {navItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        if (item.id !== 'products') setIsEditingProduct(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#16120b] text-[#F4E0A5] border border-[#3b2e1b] font-semibold'
                          : 'text-neutral-400 hover:text-white border border-transparent'
                      }`}
                    >
                      <span className={isActive ? 'text-[#D6B16D]' : 'text-neutral-500'}>{item.icon}</span>
                      <span>{item.label}</span>
                      {typeof item.count === 'number' && (
                        <span className="font-mono tabular-nums text-[10px] text-[#D6B16D]/80">
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {seedSuccessCount !== null && (
                <div className="px-4 sm:px-6 py-2.5 bg-emerald-950/80 border-b border-emerald-700/70 text-xs text-emerald-200 flex items-center justify-center gap-2 shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Successfully synced {seedSuccessCount} masterworks directly into Cloud Firestore.</span>
                </div>
              )}

              {adminError && (
                <div className="px-4 sm:px-6 py-2.5 bg-red-950/80 border-b border-red-700/70 text-xs text-red-200 flex items-center justify-between gap-3 shrink-0">
                  <span>{adminError}</span>
                  <button onClick={() => setAdminError(null)} className="text-red-300 hover:text-white p-1 shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* SCROLLABLE WORKSPACE BODY */}
              <div className="p-4 sm:p-6 lg:p-7 flex-1 overflow-y-auto overscroll-contain space-y-6">

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Unified 4-Column Executive KPI Strip (Single Elevation + Hairline Dividers) */}
              <div className="rounded-xl bg-[#0f0c08] border border-[#261f13] grid grid-cols-2 lg:grid-cols-4 overflow-hidden">
                <div className="p-4 sm:p-5 space-y-1.5 border-r border-b lg:border-b-0 border-[#211a10]">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-neutral-400 font-semibold">
                    <span>Total Revenue</span>
                    <DollarSign className="w-3.5 h-3.5 text-[#D6B16D] shrink-0" />
                  </div>
                  <p className="text-lg sm:text-2xl font-mono tabular-nums font-bold text-white truncate">
                    {formatPKR(totalRevenue)}
                  </p>
                  <p className="text-[11px] text-neutral-400 font-mono tabular-nums truncate">
                    <span className="text-emerald-400">{paidOrdersCount} paid</span> · {pendingVerifyCount} awaiting
                  </p>
                </div>

                <div className="p-4 sm:p-5 space-y-1.5 border-b lg:border-b-0 lg:border-r border-[#211a10]">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-neutral-400 font-semibold">
                    <span>Total Orders</span>
                    <ShoppingBag className="w-3.5 h-3.5 text-[#D6B16D] shrink-0" />
                  </div>
                  <p className="text-lg sm:text-2xl font-mono tabular-nums font-bold text-white">
                    {orders.length}
                  </p>
                  <p className="text-[11px] text-neutral-400 truncate">
                    Across web & concierge channels
                  </p>
                </div>

                <div className="p-4 sm:p-5 space-y-1.5 border-r border-[#211a10]">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-neutral-400 font-semibold">
                    <span>Pending Dispatch</span>
                    <Truck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  </div>
                  <p className="text-lg sm:text-2xl font-mono tabular-nums font-bold text-amber-300">
                    {pendingOrders.length}
                  </p>
                  <p className="text-[11px] text-amber-400/80 truncate">
                    Requires courier confirmation
                  </p>
                </div>

                <div className="p-4 sm:p-5 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-neutral-400 font-semibold">
                    <span>Inventory Valuation</span>
                    <Package className="w-3.5 h-3.5 text-[#D6B16D] shrink-0" />
                  </div>
                  <p className="text-lg sm:text-2xl font-mono tabular-nums font-bold text-white truncate">
                    {formatPKR(inventoryValue)}
                  </p>
                  <p className="text-[11px] text-neutral-400 font-mono tabular-nums truncate">
                    {products.length} pieces · {categories.length} collections
                  </p>
                </div>
              </div>

              {/* Asymmetric 2-Column Executive Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Recent Customer Dispatches (7 cols) */}
                <div className="lg:col-span-7 rounded-xl bg-[#0f0c08] border border-[#261f13] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#211a10] flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-serif font-semibold text-white">
                        Recent Customer Dispatches
                      </h4>
                      <p className="text-[11px] text-neutral-400">
                        Latest orders recorded on ZN JEWELLERS
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className="text-xs text-[#D6B16D] hover:text-[#F4E0A5] flex items-center gap-1 font-medium cursor-pointer shrink-0"
                    >
                      <span>View All</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {loadingOrders ? (
                    <div className="p-6 text-xs text-neutral-400">Loading order records...</div>
                  ) : orders.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <ShoppingBag className="w-6 h-6 text-neutral-600 mx-auto" />
                      <p className="text-xs text-neutral-400">No customer orders recorded yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1c160e]">
                      {orders.slice(0, 6).map((ord) => (
                        <div
                          key={ord.id}
                          className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#141009] transition-colors"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-mono font-bold text-[#D6B16D]">
                                {ord.orderNumber}
                              </span>
                              <span className="text-neutral-600">·</span>
                              <span className="text-white font-medium truncate">
                                {ord.customerName}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-400 truncate">
                              {ord.city} · {ord.paymentMethod.replace('_', ' ')} · {formatDate(ord.createdAt)}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-[#D6B16D] hidden sm:inline">
                              {ord.orderStatus}
                            </span>
                            <span className="font-mono tabular-nums font-semibold text-white text-xs">
                              {formatPKR(ord.total)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceOrder(ord)}
                              title="Open Commercial Invoice"
                              className="p-1.5 rounded bg-[#16120b] border border-[#2b2114] text-neutral-300 hover:text-[#D6B16D] hover:border-[#D6B16D]/60 transition-colors cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stock Watchlist & Inventory Audit Log (5 cols) */}
                <div className="lg:col-span-5 space-y-5">
                  {/* Low Stock Attention Panel */}
                  <div className="rounded-xl bg-[#0f0c08] border border-[#261f13] overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#211a10] flex items-center justify-between">
                      <h4 className="text-xs font-serif font-semibold uppercase tracking-wider text-white">
                        Low Stock Watchlist
                      </h4>
                      <span className="text-[11px] font-mono tabular-nums text-neutral-400">
                        {lowStockProducts.length} alert{lowStockProducts.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {lowStockProducts.length === 0 ? (
                      <div className="px-5 py-4 text-xs text-emerald-400/90 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>All {products.length} catalogue items have healthy stock.</span>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#1c160e] max-h-52 overflow-y-auto">
                        {lowStockProducts.slice(0, 5).map((p) => (
                          <div
                            key={p.id}
                            className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-[#141009] transition-colors text-xs"
                          >
                            <div className="min-w-0">
                              <span className="text-white font-medium block truncate">{p.name}</span>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                {p.sku} · {p.category}
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span
                                className={`font-mono tabular-nums text-[11px] font-bold ${
                                  p.stock <= 0 ? 'text-red-400' : 'text-amber-300'
                                }`}
                              >
                                {p.stock} left
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('products');
                                  handleOpenEditProduct(p);
                                }}
                                className="text-[11px] text-[#D6B16D] hover:underline cursor-pointer"
                              >
                                Restock
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Inventory Audit Trail */}
                  <div className="rounded-xl bg-[#0f0c08] border border-[#261f13] overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[#211a10] flex items-center justify-between">
                      <h4 className="text-xs font-serif font-semibold uppercase tracking-wider text-white">
                        Inventory Audit Stream
                      </h4>
                      <span className="text-[11px] text-neutral-400 font-mono tabular-nums">
                        {inventoryLogs.length} events
                      </span>
                    </div>

                    {inventoryLogs.length === 0 ? (
                      <div className="px-5 py-4 text-xs text-neutral-400">
                        Stock adjustments and order deductions will appear here automatically.
                      </div>
                    ) : (
                      <div className="divide-y divide-[#1c160e] max-h-60 overflow-y-auto">
                        {inventoryLogs.slice(0, 6).map((log) => (
                          <div
                            key={log.id}
                            className="px-5 py-3 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="text-white font-medium block truncate">
                                {log.productName || log.productId}
                              </span>
                              <span className="text-[10px] text-neutral-400 font-mono block truncate">
                                {log.reason.replace(/_/g, ' ')}
                                {log.orderNumber ? ` · ${log.orderNumber}` : ''} · {formatDate(log.createdAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                              <span
                                className={`text-[11px] font-bold ${
                                  log.delta < 0 ? 'text-amber-300' : 'text-emerald-400'
                                }`}
                              >
                                {log.delta > 0 ? `+${log.delta}` : log.delta}
                              </span>
                              <span className="text-neutral-400 text-[11px]">→ {log.newStock}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCTS CATALOGUE */}
          {activeTab === 'products' && (
            <div className="space-y-5">
              {!isEditingProduct ? (
                <>
                  {productSavedSuccess && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-600/50 text-emerald-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-medium">{productSavedSuccess}</span>
                      </div>
                      <button
                        onClick={() => setProductSavedSuccess(null)}
                        className="text-emerald-400 hover:text-white p-1 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Executive Filter & Action Toolbar */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#D6B16D]" />
                        <input
                          type="text"
                          value={prodSearchQuery}
                          onChange={(e) => setProdSearchQuery(e.target.value)}
                          placeholder="Search name, SKU, or material..."
                          className="w-full bg-[#0f0c08] border border-[#2c2315] rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D6B16D]"
                        />
                        {prodSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setProdSearchQuery('')}
                            className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <select
                        value={prodCategoryFilter}
                        onChange={(e) => setProdCategoryFilter(e.target.value)}
                        className="bg-[#0f0c08] border border-[#2c2315] rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-[#D6B16D]"
                      >
                        <option value="ALL">All Collections ({products.length})</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleOpenNewProduct}
                      className="sm:hidden px-4 py-2.5 bg-[#D6B16D] text-black text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-[#F4E0A5] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New Masterwork</span>
                    </button>
                  </div>

                  {filteredProducts.length === 0 ? (
                    <div className="p-10 rounded-xl bg-[#0f0c08] border border-[#261f13] text-center space-y-3">
                      <Package className="w-7 h-7 text-neutral-600 mx-auto" />
                      <div className="space-y-1">
                        <p className="text-sm font-serif text-white">No matching products found</p>
                        <p className="text-xs text-neutral-400">
                          Adjust your search query or category filter, or add a new creation.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setProdSearchQuery('');
                          setProdCategoryFilter('ALL');
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-[#16120b] border border-[#3b2e1b] text-[#D6B16D] text-xs font-medium cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Mobile Product List (Hairline-divided architectural rows, zero overflow) */}
                      <div className="md:hidden rounded-xl bg-[#0f0c08] border border-[#261f13] divide-y divide-[#1e170e]">
                        {filteredProducts.map((p) => (
                          <div key={p.id} className="p-3.5 flex items-start gap-3">
                            <img
                              src={p.images[0] || '/hero-steel.jpg'}
                              alt={p.name}
                              className="w-13 h-13 rounded-lg object-cover border border-[#322717] shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).src = '/hero-steel.jpg'; }}
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <span className="font-serif font-medium text-white text-xs block truncate">
                                {p.name}
                              </span>
                              <p className="text-[11px] text-neutral-400 truncate">
                                <span className="font-mono">{p.sku}</span> · <span className="text-[#D6B16D]">{p.category}</span>
                              </p>
                              <div className="flex items-center justify-between gap-2 pt-1">
                                <div className="flex items-center gap-2.5">
                                  <span className="font-mono tabular-nums font-bold text-[#D6B16D] text-xs">
                                    {formatPKR(p.salePrice ?? p.price)}
                                  </span>
                                  <span
                                    className={`font-mono tabular-nums text-[10px] font-semibold ${
                                      p.stock <= 0 ? 'text-red-400' : p.stock <= 2 ? 'text-amber-300' : 'text-emerald-400'
                                    }`}
                                  >
                                    {p.stock} left
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => handleOpenEditProduct(p)}
                                    className="p-1.5 rounded bg-[#16120b] text-neutral-200 hover:text-[#D6B16D] border border-[#2d2214]"
                                    title="Edit Product"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmTarget({ type: 'product', id: p.id, name: p.name })}
                                    className="p-1.5 rounded bg-[#16120b] text-neutral-400 hover:text-red-400 border border-[#2d2214]"
                                    title="Delete Product"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Products Ledger Table */}
                      <div className="hidden md:block rounded-xl border border-[#261f13] overflow-hidden bg-[#0f0c08]">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#141009] border-b border-[#261f13] text-neutral-400 uppercase tracking-wider text-[10px]">
                              <tr>
                                <th className="py-3 px-4 font-semibold">Piece Details</th>
                                <th className="py-3 px-4 font-semibold">Category</th>
                                <th className="py-3 px-4 font-semibold">Material / Craft</th>
                                <th className="py-3 px-4 font-semibold text-right">Price (PKR)</th>
                                <th className="py-3 px-4 font-semibold text-right">Stock</th>
                                <th className="py-3 px-4 font-semibold text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1e170e]">
                              {filteredProducts.map((p) => (
                                <tr key={p.id} className="hover:bg-[#141009] transition-colors">
                                  <td className="py-2.5 px-4 flex items-center gap-3">
                                    <img
                                      src={p.images[0] || '/hero-steel.jpg'}
                                      alt={p.name}
                                      className="w-9 h-9 rounded-md object-cover border border-[#322717] shrink-0"
                                      onError={(e) => { (e.target as HTMLImageElement).src = '/hero-steel.jpg'; }}
                                    />
                                    <div className="min-w-0">
                                      <span className="font-serif font-medium text-white block truncate max-w-[260px]">
                                        {p.name}
                                      </span>
                                      <span className="text-[10px] font-mono text-neutral-400">{p.sku}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-4 text-neutral-300">{p.category}</td>
                                  <td className="py-2.5 px-4 text-neutral-400 truncate max-w-[200px]">
                                    {p.material || p.goldPurity || 'Handcrafted'}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-[#D6B16D]">
                                    {formatPKR(p.price)}
                                  </td>
                                  <td className="py-2.5 px-4 text-right">
                                    <span
                                      className={`font-mono tabular-nums text-[11px] font-bold ${
                                        p.stock <= 0 ? 'text-red-400' : p.stock <= 2 ? 'text-amber-300' : 'text-emerald-400'
                                      }`}
                                    >
                                      {p.stock} units
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 text-right">
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        onClick={() => handleOpenEditProduct(p)}
                                        className="p-1.5 rounded bg-[#16120b] text-neutral-300 hover:text-[#D6B16D] border border-[#2d2214] cursor-pointer"
                                        title="Edit"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeleteConfirmTarget({ type: 'product', id: p.id, name: p.name })}
                                        className="p-1.5 rounded bg-[#16120b] text-neutral-400 hover:text-red-400 border border-[#2d2214] hover:border-red-500/40 transition-colors cursor-pointer"
                                        title="Delete Product"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                /* Edit / Add Product Form */
                <form onSubmit={handleSaveProduct} noValidate className="p-3.5 sm:p-6 rounded-xl bg-[#0f0c08] border border-[#292014] space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#211a10]">
                    <h4 className="text-sm font-serif font-semibold text-white uppercase tracking-wider">
                      {editingProductId ? 'Edit Product Details' : 'Create New Luxury Creation'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsEditingProduct(false)}
                      className="text-xs text-neutral-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-neutral-300 mb-1">Product Title *</label>
                      <input
                        type="text"
                        value={prodName}
                        onChange={(e) => setProdName(e.target.value)}
                        required
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-neutral-300 mb-1">SKU *</label>
                      <input
                        type="text"
                        value={prodSku}
                        onChange={(e) => setProdSku(e.target.value)}
                        required
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] uppercase tracking-wider text-neutral-300">Category / Collection *</label>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('collections');
                            setIsCreatingCollection(true);
                          }}
                          className="text-[10px] text-[#D6B16D] hover:underline"
                        >
                          + New Collection
                        </button>
                      </div>
                      <select
                        value={prodCategory}
                        onChange={(e) => setProdCategory(e.target.value as ProductCategory)}
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} {c.isCustom ? '★ (Custom Collection)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-neutral-300 mb-1">Price *</label>
                      <input
                        type="number"
                        value={prodPrice}
                        onChange={(e) => setProdPrice(Number(e.target.value))}
                        required
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-neutral-300 mb-1">Sale Price (Optional)</label>
                      <input
                        type="number"
                        value={prodSalePrice || ''}
                        onChange={(e) => setProdSalePrice(e.target.value ? Number(e.target.value) : undefined)}
                        placeholder="Leave empty if no discount"
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-neutral-300 mb-1">Material & Crafting</label>
                      <select
                        value={prodGoldPurity}
                        onChange={(e) => setProdGoldPurity(e.target.value as any)}
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      >
                        <option value="Stainless Steel & Mineral Glass">Stainless Steel & Mineral Glass (Watches)</option>
                        <option value="18K PVD Gold Anti-Tarnish">18K PVD Gold Anti-Tarnish (Stainless Steel)</option>
                        <option value="316L Stainless Steel 18K PVD">316L Stainless Steel 18K PVD</option>
                        <option value="Brass Kundan & Velvet">Brass Kundan & Velvet (Bridal Bangles)</option>
                        <option value="Structured Vegan Leather">Structured Vegan Leather (Handbags)</option>
                        {![
                          'Stainless Steel & Mineral Glass',
                          '18K PVD Gold Anti-Tarnish',
                          '316L Stainless Steel 18K PVD',
                          'Brass Kundan & Velvet',
                          'Structured Vegan Leather',
                        ].includes(prodGoldPurity) && (
                          <option value={prodGoldPurity}>{prodGoldPurity}</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-neutral-300 mb-1">Item Weight or Dimensions (Optional)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={prodWeight}
                        onChange={(e) => setProdWeight(Number(e.target.value))}
                        placeholder="e.g. 150 grams"
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-neutral-300 mb-1">Stock Quantity *</label>
                      <input
                        type="number"
                        value={prodStock}
                        onChange={(e) => setProdStock(Number(e.target.value))}
                        required
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] uppercase tracking-wider text-neutral-300 mb-1">Customization / Name Notice</label>
                      <input
                        type="text"
                        value={prodDiamondDetails}
                        onChange={(e) => setProdDiamondDetails(e.target.value)}
                        placeholder="e.g. Free custom name engraving for bride & groom"
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>

                    {/* Direct Device File Upload (Mobile & Laptop) */}
                    <div className="sm:col-span-2 space-y-3 p-4 rounded-xl bg-[#141009] border border-[#2d2215]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <label className="block text-xs uppercase tracking-wider text-[#D6B16D] font-bold">
                              Product Images ({imageFiles.length})
                            </label>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-[#D6B16D]/20 text-[#D6B16D] font-medium">
                              Multiple Images Supported (2, 3 یا زیادہ)
                            </span>
                          </div>
                          <span className="text-[11px] text-neutral-400">
                            ایک پروڈکٹ کی 2، 3 یا اس سے زیادہ مختلف زاویوں (angles) کی تصاویر موبائل یا لیپ ٹاپ سے شامل کریں۔
                          </span>
                        </div>

                        <div>
                          <label
                            htmlFor="admin-device-file-input"
                            className="px-4 py-2 bg-gradient-to-r from-[#D6B16D] to-[#F4E0A5] text-black text-xs font-semibold uppercase tracking-wider rounded-lg hover:shadow-lg hover:shadow-[#D6B16D]/20 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{imageFiles.length > 0 ? '+ Add More Photos' : 'Upload Photos (Mobile / Laptop)'}</span>
                          </label>
                          <input
                            id="admin-device-file-input"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleDeviceFileUpload}
                            className="hidden"
                          />
                        </div>
                      </div>

                      {/* Dropzone click area */}
                      <label
                        htmlFor="admin-device-file-input"
                        className="block p-5 rounded-xl border-2 border-dashed border-[#3b2e1b] hover:border-[#D6B16D] transition-colors text-center cursor-pointer bg-[#0c0906] group"
                      >
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="w-10 h-10 rounded-full bg-[#18130a] border border-[#3b2e1b] flex items-center justify-center text-[#D6B16D] group-hover:scale-110 transition-transform">
                            <Camera className="w-5 h-5" />
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs font-medium text-white">
                              <span className="text-[#D6B16D] font-semibold underline">Tap or Click to Select Multiple Photos</span>
                            </p>
                            <p className="text-[11px] text-neutral-400">
                              ایک ساتھ 2، 3 یا زیادہ تصاویر منتخب کر سکتے ہیں (Front, Side, Close-up angles)
                            </p>
                          </div>
                          {isUploadingImages && (
                            <span className="text-xs text-[#D6B16D] font-mono animate-pulse block">
                              Optimizing & attaching device images...
                            </span>
                          )}
                        </div>
                      </label>

                      {/* Attached Thumbnails Grid */}
                      {imageFiles.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
                              Attached Photos (First is Cover photo — click any to set as Cover):
                            </span>
                            <div className="flex items-center gap-2">
                              <label
                                htmlFor="admin-device-file-input"
                                className="text-[10px] text-[#D6B16D] hover:underline cursor-pointer flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add More</span>
                              </label>
                              <span className="text-[10px] text-neutral-500 font-mono">
                                • {imageFiles.length} photo{imageFiles.length > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {imageFiles.map((imgUrl, idx) => (
                              <div
                                key={idx}
                                onClick={() => handleSetPrimaryImage(idx)}
                                className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer group transition-all ${
                                  idx === 0
                                    ? 'border-[#D6B16D] shadow-md shadow-[#D6B16D]/20 ring-1 ring-[#D6B16D]'
                                    : 'border-[#2d2215] hover:border-neutral-500'
                                }`}
                              >
                                <img src={imgUrl} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />

                                {idx === 0 && (
                                  <span className="absolute bottom-1 left-1 right-1 text-center bg-black/85 backdrop-blur-sm text-[#D6B16D] text-[9px] uppercase font-bold py-0.5 rounded">
                                    Cover
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveImage(idx);
                                  }}
                                  className="absolute top-1 right-1 p-1 rounded-full bg-black/80 text-neutral-300 hover:text-red-400 hover:bg-black transition-colors"
                                  title="Remove image"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Optional Web Link / Preset Helper */}
                      <div className="pt-2 border-t border-[#231a0e] flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
                          <input
                            type="text"
                            placeholder="Optional: Or paste image web link..."
                            value={customUrlInput}
                            onChange={(e) => setCustomUrlInput(e.target.value)}
                            className="flex-1 bg-[#0a0805] border border-[#2b2114] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#D6B16D] placeholder:text-neutral-600"
                          />
                          <button
                            type="button"
                            onClick={handleAddUrlImage}
                            className="px-3 py-1.5 bg-[#1f190e] border border-[#3b2e1b] text-[#D6B16D] rounded text-xs hover:bg-[#D6B16D] hover:text-black transition-colors"
                          >
                            Add
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handleApplyCategoryPreset}
                          className="text-[11px] text-[#D6B16D] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Load Sample Photo for {prodCategory}</span>
                        </button>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] uppercase tracking-wider text-neutral-300 mb-1">Description</label>
                      <textarea
                        rows={3}
                        value={prodDescription}
                        onChange={(e) => setProdDescription(e.target.value)}
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>

                    <div className="flex items-center gap-6 sm:col-span-2 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prodIsFeatured}
                          onChange={(e) => setProdIsFeatured(e.target.checked)}
                          className="accent-[#D6B16D]"
                        />
                        <span>Featured on Homepage</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prodIsNewArrival}
                          onChange={(e) => setProdIsNewArrival(e.target.checked)}
                          className="accent-[#D6B16D]"
                        />
                        <span>Mark as New Arrival</span>
                      </label>
                    </div>
                  </div>

                  {formValidationError && (
                    <div className="p-3.5 rounded-lg bg-red-950/80 border border-red-500/60 text-red-200 text-xs flex items-center gap-2.5 animate-shake">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="font-medium">{formValidationError}</span>
                    </div>
                  )}

                  <div className="pt-4 border-t border-[#211a10] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-[11px] text-neutral-400">
                      * Required fields (Title, Price, Stock)
                    </span>

                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setIsEditingProduct(false)}
                        className="px-4 py-2 rounded bg-neutral-900 text-neutral-400 hover:text-white transition-colors cursor-pointer text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleSaveProduct(e)}
                        disabled={savingProduct}
                        className="px-6 py-2.5 bg-gradient-to-r from-[#D6B16D] to-[#F4E0A5] text-black text-xs font-bold uppercase tracking-wider rounded-lg hover:shadow-lg hover:shadow-[#D6B16D]/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        <span>{savingProduct ? 'Saving Product...' : 'Save Product'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}

            </div>
          )}

          {/* TAB: COLLECTIONS MANAGEMENT */}
          {activeTab === 'collections' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#221c13] pb-4">
                <div>
                  <h4 className="text-sm font-serif font-semibold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#D6B16D]" />
                    <span>Storefront Collections ({categories.length})</span>
                  </h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Custom product lines automatically sync across navigation menus, homepage, and shop filters.
                  </p>
                </div>

                <button
                  onClick={() => setIsCreatingCollection(!isCreatingCollection)}
                  className="sm:hidden px-4 py-2 bg-[#D6B16D] text-black text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-[#F4E0A5] transition-colors flex items-center justify-center gap-2 shrink-0 self-start"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isCreatingCollection ? 'Close Creator' : 'Create New Collection'}</span>
                </button>
              </div>

              {colSuccessMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{colSuccessMessage}</span>
                </div>
              )}

              {/* CREATE COLLECTION FORM */}
              {isCreatingCollection && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newColName.trim()) return;
                    setColSaving(true);
                    try {
                      await addCollection({
                        name: newColName.trim(),
                        tagline: newColTagline.trim() || 'Curated Collection',
                        description: newColDescription.trim() || 'Curated fashion pieces by ZN Jewelers.',
                        image: newColImage || '/hero-steel.jpg'
                      });
                      setColSuccessMessage(`Collection "${newColName.trim()}" created successfully!`);
                      setNewColName('');
                      setNewColTagline('');
                      setNewColDescription('');
                      setNewColImage('/hero-steel.jpg');
                      setIsCreatingCollection(false);
                      setTimeout(() => setColSuccessMessage(null), 3500);
                    } catch (err: any) {
                      console.error('Failed to create collection:', err);
                      setAdminError(err?.message || 'Could not create collection in Firestore.');
                    } finally {
                      setColSaving(false);
                    }
                  }}
                  className="p-5 bg-[#0f0c08] border border-[#D6B16D]/40 rounded-xl space-y-4 animate-fadeIn"
                >
                  <div className="flex items-center justify-between border-b border-[#261f14] pb-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-[#D6B16D]">
                      Create New Custom Collection
                    </h5>
                    <button
                      type="button"
                      onClick={() => setIsCreatingCollection(false)}
                      className="text-neutral-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-neutral-300 mb-1 font-medium">Collection Name *</label>
                      <input
                        type="text"
                        value={newColName}
                        onChange={(e) => setNewColName(e.target.value)}
                        placeholder="e.g. Stainless Steel Collection, Men's Rings..."
                        required
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-300 mb-1 font-medium">Tagline / Subheading</label>
                      <input
                        type="text"
                        value={newColTagline}
                        onChange={(e) => setNewColTagline(e.target.value)}
                        placeholder="e.g. 100% Waterproof & Anti-Tarnish"
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-neutral-300 mb-1 font-medium">Description</label>
                    <textarea
                      rows={2}
                      value={newColDescription}
                      onChange={(e) => setNewColDescription(e.target.value)}
                      placeholder="Brief description of the collection style and craftsmanship..."
                      className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-300 mb-1 font-medium">Featured Image URL</label>
                    <input
                      type="text"
                      value={newColImage}
                      onChange={(e) => setNewColImage(e.target.value)}
                      placeholder="/hero-steel.jpg or external image URL"
                      className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-neutral-500 mr-1">Quick Select Photo:</span>
                      {[
                        { label: 'Steel Jewellery', url: '/hero-steel.jpg' },
                        { label: 'Watches', url: '/hero-watches.jpg' },
                        { label: 'Bangles', url: '/hero-bangles.jpg' },
                        { label: 'Handbags', url: '/hero-handbags.jpg' },
                        { label: 'Jewellery Sets', url: '/hero-sets.jpg' },
                        { label: 'Rings', url: '/hero-rings.jpg' },
                        { label: 'Earrings', url: '/hero-earrings.jpg' }
                      ].map((preset) => (
                        <button
                          key={preset.url}
                          type="button"
                          onClick={() => setNewColImage(preset.url)}
                          className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                            newColImage === preset.url
                              ? 'bg-[#D6B16D] text-black border-[#D6B16D] font-bold'
                              : 'bg-[#1a160f] text-neutral-400 border-[#2b2214] hover:text-white'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingCollection(false)}
                      className="px-4 py-2 rounded text-xs text-neutral-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={colSaving}
                      className="px-5 py-2 bg-[#D6B16D] text-black text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-[#F4E0A5] transition-colors flex items-center gap-2"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{colSaving ? 'Creating...' : 'Publish Collection'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* COLLECTIONS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {categories.map((col) => {
                  const productCount = products.filter(
                    (p) => p.category === col.name
                  ).length;

                  return (
                    <div
                      key={col.id}
                      className="bg-[#0f0c08] border border-[#261f13] hover:border-[#D6B16D]/50 rounded-xl overflow-hidden flex flex-col justify-between transition-colors"
                    >
                      {/* Clean Image Header */}
                      <div className="relative aspect-video w-full overflow-hidden bg-black">
                        <img
                          src={col.image || '/hero-steel.jpg'}
                          alt={col.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0c08] via-transparent to-transparent" />
                      </div>

                      {/* Content */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider font-semibold">
                            <span className="text-[#D6B16D] truncate">
                              {col.isCustom ? 'Custom Line' : 'Flagship'} · {col.tagline}
                            </span>
                            <span className="font-mono tabular-nums text-neutral-400 shrink-0">
                              {productCount} items
                            </span>
                          </div>
                          <h5 className="font-serif font-bold text-white text-base mt-1">
                            {col.name}
                          </h5>
                          <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                            {col.description}
                          </p>
                        </div>

                        <div className="pt-2.5 border-t border-[#1e170e] flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setProdCategoryFilter(col.name);
                              setActiveTab('products');
                            }}
                            className="text-[#D6B16D] hover:text-[#F4E0A5] flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                          >
                            <span>Inspect Items ({productCount})</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmTarget({ type: 'collection', id: col.id, name: col.name })}
                            className="text-neutral-400 hover:text-red-400 p-1.5 rounded hover:bg-red-950/30 transition-colors cursor-pointer"
                            title="Delete Collection"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: ORDER MANAGEMENT */}
          {activeTab === 'orders' && (
            <div className="space-y-5">
              {/* Executive Orders Search & Status Filter Strip */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#D6B16D]" />
                    <input
                      type="text"
                      placeholder="Search Order #, Client, Phone, TRX, or SKU..."
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      className="w-full bg-[#0f0c08] border border-[#2c2315] rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D6B16D] transition-colors"
                    />
                    {orderSearchQuery && (
                      <button
                        onClick={() => setOrderSearchQuery('')}
                        className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-white"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <span className="text-[11px] font-mono tabular-nums text-neutral-400">
                    Showing {orders.filter((o) => orderStatusFilter === 'ALL' || o.orderStatus === orderStatusFilter).length} of {orders.length} orders
                  </span>
                </div>

                {/* Segmented Status Filter Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                  {(
                    ['ALL', 'Order Placed', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] as const
                  ).map((statusKey) => {
                    const count =
                      statusKey === 'ALL'
                        ? orders.length
                        : orders.filter((o) => o.orderStatus === statusKey).length;
                    const active = orderStatusFilter === statusKey;
                    return (
                      <button
                        key={statusKey}
                        type="button"
                        onClick={() => setOrderStatusFilter(statusKey)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#16120b] text-[#F4E0A5] border border-[#3b2e1b] font-semibold'
                            : 'bg-[#0f0c08] text-neutral-400 border border-[#211a10] hover:text-white'
                        }`}
                      >
                        <span>{statusKey === 'ALL' ? 'All Orders' : statusKey}</span>
                        <span className="font-mono tabular-nums text-[10px] text-[#D6B16D]">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Order Edit Dialog */}
              {selectedOrderToEdit && (
                <div className="p-5 rounded-xl bg-[#141009] border border-[#3d301b] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#221a10]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-serif font-semibold text-white">
                        Modify Status: <strong className="text-[#D6B16D]">{selectedOrderToEdit.orderNumber}</strong> ({selectedOrderToEdit.customerName})
                      </span>
                    </div>
                    <button onClick={() => setSelectedOrderToEdit(null)} className="text-neutral-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Display Ordered Items with Images in edit modal */}
                  <div className="p-3 rounded-lg bg-[#0c0906] border border-[#241a10] space-y-2">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold block">
                      Ordered Items to Dispatch ({selectedOrderToEdit.items.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedOrderToEdit.items.map((it, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 p-2 rounded bg-[#141009] border border-[#22180d]">
                          <img
                            src={it.image || '/hero-steel.jpg'}
                            alt={it.name}
                            className="w-10 h-10 rounded object-cover border border-[#3b2e1b] bg-black shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/hero-steel.jpg'; }}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-serif text-white text-xs block truncate">{it.name}</span>
                            <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                              <span>SKU: {it.sku}</span>
                              <span className="text-[#D6B16D] font-bold">x{it.quantity}</span>
                              <span>{formatPKR(it.price)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-neutral-400 mb-1">Order Status</label>
                      <select
                        value={newOrderStatus}
                        onChange={(e) => setNewOrderStatus(e.target.value as OrderStatus)}
                        className="w-full bg-[#0a0805] border border-[#2d2315] rounded px-3 py-2 text-white"
                      >
                        <option value="Order Placed">Order Placed</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Processing">Processing (In Atelier)</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Out for Delivery">Out for Delivery</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-neutral-400 mb-1">Payment Status</label>
                      <select
                        value={newPaymentStatus}
                        onChange={(e) => setNewPaymentStatus(e.target.value as any)}
                        className="w-full bg-[#0a0805] border border-[#2d2315] rounded px-3 py-2 text-white"
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid & Verified</option>
                        <option value="failed">Failed / Cancelled</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-neutral-400 mb-1">Courier Tracking ID</label>
                      <input
                        type="text"
                        value={newTrackingNumber}
                        onChange={(e) => setNewTrackingNumber(e.target.value)}
                        placeholder="e.g. TCS-ARM-90284"
                        className="w-full bg-[#0a0805] border border-[#2d2315] rounded px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  {/* Payment Proof & Verification History */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <label className="block text-neutral-400 mb-1">Verification / Audit Note (Optional)</label>
                      <input
                        type="text"
                        value={verificationNote}
                        onChange={(e) => setVerificationNote(e.target.value)}
                        placeholder="e.g. TRX verified in Meezan / Easypaisa app"
                        className="w-full bg-[#0a0805] border border-[#2d2315] rounded px-3 py-2 text-white"
                      />
                    </div>

                    {selectedOrderToEdit.paymentProofUrl && (
                      <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[#0c0906] border border-[#2d2315]">
                        <img
                          src={selectedOrderToEdit.paymentProofUrl}
                          alt="Payment Receipt"
                          onClick={() => setPreviewProofUrl(selectedOrderToEdit.paymentProofUrl || null)}
                          className="w-12 h-12 rounded object-cover border border-[#D6B16D]/50 cursor-pointer shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[#D6B16D] font-semibold block">Payment Receipt Uploaded</span>
                          <button
                            type="button"
                            onClick={() => setPreviewProofUrl(selectedOrderToEdit.paymentProofUrl || null)}
                            className="text-[11px] text-neutral-300 underline hover:text-white"
                          >
                            View Full Receipt
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedOrderToEdit.paymentVerificationHistory && selectedOrderToEdit.paymentVerificationHistory.length > 0 && (
                    <div className="p-2.5 rounded bg-[#0c0906] border border-[#241a10] text-[11px] space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold block">
                        Payment Verification Log:
                      </span>
                      {selectedOrderToEdit.paymentVerificationHistory.map((h, i) => (
                        <div key={i} className="text-neutral-300 flex flex-wrap gap-2">
                          <span className="text-[#D6B16D] uppercase font-bold">{h.status}</span>
                          <span>by {h.verifiedBy}</span>
                          <span className="text-neutral-500">• {formatDate(h.verifiedAt)}</span>
                          {h.note && <span className="text-neutral-400">({h.note})</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className="flex items-center gap-2">
                      {selectedOrderToEdit.paymentStatus !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewPaymentStatus('paid');
                            if (newOrderStatus === 'Order Placed') setNewOrderStatus('Confirmed');
                          }}
                          className="px-3 py-1.5 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-medium hover:bg-emerald-900 transition-colors"
                        >
                          Mark Payment Verified
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setVerificationNote('');
                          setSelectedOrderToEdit(null);
                        }}
                        className="px-3 py-1.5 rounded bg-neutral-900 text-xs text-neutral-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={updatingOrder}
                        onClick={handleUpdateOrderStatus}
                        className="px-5 py-1.5 rounded bg-[#D6B16D] text-black text-xs font-semibold uppercase hover:bg-[#F4E0A5] disabled:opacity-50"
                      >
                        {updatingOrder ? 'Updating...' : 'Update Order'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {customerWaQuickAlert && (
                <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-600/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2.5 text-emerald-100">
                    <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">
                        Order {customerWaQuickAlert.orderNumber} marked as {customerWaQuickAlert.orderStatus}!
                      </p>
                      <p className="text-[11px] text-emerald-200/80">
                        Direct Free WhatsApp QR is currently disconnected—tap to send the confirmation message to {customerWaQuickAlert.customerName} in 1 click (or connect QR in Settings for automatic alerts).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={customerWaQuickAlert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setCustomerWaQuickAlert(null)}
                      className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Customer Msg</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setCustomerWaQuickAlert(null)}
                      className="p-1.5 text-neutral-400 hover:text-white"
                      aria-label="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Orders List */}
              <div className="space-y-3.5">
                {orders
                  .filter((o) => {
                    if (orderStatusFilter !== 'ALL' && o.orderStatus !== orderStatusFilter) {
                      return false;
                    }
                    if (!orderSearchQuery) return true;
                    const q = orderSearchQuery.toLowerCase().trim();
                    const inNumber = o.orderNumber?.toLowerCase().includes(q);
                    const inId = o.id?.toLowerCase().includes(q);
                    const inName = o.customerName?.toLowerCase().includes(q);
                    const inPhone = o.customerPhone?.replace(/[^0-9]/g, '').includes(q.replace(/[^0-9]/g, '')) || o.customerPhone?.includes(q);
                    const inEmail = o.customerEmail?.toLowerCase().includes(q);
                    const inCity = o.city?.toLowerCase().includes(q);
                    const inRef = o.paymentReference && o.paymentReference.toLowerCase().includes(q);
                    const inTracking = o.trackingNumber && o.trackingNumber.toLowerCase().includes(q);
                    const inItems = o.items && o.items.some(
                      (it) => it.name?.toLowerCase().includes(q) || it.sku?.toLowerCase().includes(q)
                    );
                    return inNumber || inId || inName || inPhone || inEmail || inCity || inRef || inTracking || inItems;
                  })
                  .map((ord) => {
                    const rawDigits = ord.customerPhone ? ord.customerPhone.replace(/[^0-9]/g, '') : '';
                    const cleanPhone = rawDigits.startsWith('00')
                      ? rawDigits.slice(2)
                      : rawDigits.startsWith('0') && rawDigits.length === 11
                      ? `92${rawDigits.slice(1)}`
                      : rawDigits.startsWith('3') && rawDigits.length === 10
                      ? `92${rawDigits}`
                      : rawDigits;
                    const statusWaMsg = `Assalam-o-Alaikum ${ord.customerName}! ZN JEWELLERS ki taraf se aap ke Order ID: *${ord.orderNumber}* (Total: Rs. ${ord.total.toLocaleString()}) ka status update hai: *${ord.orderStatus}*${ord.trackingNumber ? ` (Tracking: ${ord.trackingNumber})` : ''}. Shukriya!`;
                    const whatsappLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(statusWaMsg)}` : null;

                    return (
                      <div
                        key={ord.id}
                        className="rounded-xl bg-[#0f0c08] border border-[#261f13] hover:border-[#382b18] transition-colors overflow-hidden"
                      >
                        {/* Header Row */}
                        <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                              <span className="font-mono font-bold text-[#D6B16D] text-sm">
                                {ord.orderNumber}
                              </span>
                              <span className="text-neutral-600">·</span>
                              <span className="text-white font-semibold text-sm">{ord.customerName}</span>
                              <span className="text-neutral-400">({ord.city})</span>

                              {whatsappLink && (
                                <a
                                  href={whatsappLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-mono text-[11px] hover:underline"
                                  title="Open WhatsApp Chat with Customer"
                                >
                                  <MessageCircle className="w-3 h-3 shrink-0" />
                                  <span>{ord.customerPhone}</span>
                                </a>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-neutral-400">
                              <span>{formatDate(ord.createdAt)}</span>
                              <span className="text-neutral-600">·</span>
                              <span className="text-neutral-200 capitalize">
                                {ord.paymentMethod.replace('_', ' ')}
                              </span>
                              {ord.paymentReference && (
                                <>
                                  <span className="text-neutral-600">·</span>
                                  <span>
                                    Ref: <strong className="text-[#D6B16D] font-mono">{ord.paymentReference}</strong>
                                  </span>
                                </>
                              )}
                              {ord.trackingNumber && (
                                <>
                                  <span className="text-neutral-600">·</span>
                                  <span>
                                    Tracking: <strong className="text-white font-mono">{ord.trackingNumber}</strong>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Total & Actions */}
                          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 shrink-0 pt-2.5 lg:pt-0 border-t lg:border-t-0 border-[#1c160e]">
                            <div className="text-left lg:text-right">
                              <span className="text-base font-mono tabular-nums font-bold text-white block">
                                {formatPKR(ord.total)}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold mt-0.5">
                                <span className="text-[#D6B16D]">{ord.orderStatus}</span>
                                <span className="text-neutral-600">·</span>
                                <span className={ord.paymentStatus === 'paid' ? 'text-emerald-400' : 'text-amber-400'}>
                                  {ord.paymentStatus}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {ord.paymentProofUrl && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewProofUrl(ord.paymentProofUrl || null)}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#141009] border border-emerald-700/50 text-emerald-300 text-xs font-medium flex items-center gap-1 hover:bg-emerald-950/60 transition-colors cursor-pointer"
                                  title="Inspect Uploaded Payment Receipt"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                  <span>Receipt</span>
                                </button>
                              )}

                              <button
                                onClick={() => setSelectedInvoiceOrder(ord)}
                                className="px-3 py-1.5 rounded-lg bg-[#141009] border border-[#2f2517] text-neutral-200 hover:text-[#D6B16D] hover:border-[#D6B16D]/60 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="View & Print Formal Commercial Invoice"
                              >
                                <FileText className="w-3.5 h-3.5 text-[#D6B16D]" />
                                <span>Invoice</span>
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedOrderToEdit(ord);
                                  setNewOrderStatus(ord.orderStatus);
                                  setNewTrackingNumber(ord.trackingNumber || '');
                                  setNewPaymentStatus(ord.paymentStatus);
                                  setVerificationNote('');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#D6B16D] text-black text-xs font-semibold hover:bg-[#F4E0A5] transition-colors cursor-pointer"
                              >
                                Manage
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Ordered Pieces Strip */}
                        <div className="px-4 sm:px-5 py-3 bg-[#0b0906] border-t border-[#1c160e]">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {ord.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2.5 p-2 rounded-lg bg-[#110e09] border border-[#211a10]"
                              >
                                <img
                                  src={item.image || '/hero-steel.jpg'}
                                  alt={item.name}
                                  className="w-10 h-10 object-cover rounded border border-[#322717] bg-black shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/hero-steel.jpg';
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                  <span className="font-serif font-medium text-white text-xs block truncate" title={item.name}>
                                    {item.name}
                                  </span>
                                  <p className="text-[10px] text-neutral-400 font-mono truncate">
                                    {item.sku}
                                    {item.selectedSize ? ` · ${item.selectedSize}` : ''} ·{' '}
                                    <span className="text-[#D6B16D] font-bold">×{item.quantity}</span> ·{' '}
                                    <span className="text-neutral-200">{formatPKR(item.price * item.quantity)}</span>
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 4: STORE SETTINGS */}
          {activeTab === 'settings' && (
            <div className="p-4 sm:p-6 rounded-xl bg-[#0f0c08] border border-[#261f13] space-y-6 max-w-5xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#211a10] pb-4">
                <div>
                  <h4 className="text-sm font-serif font-semibold text-white">
                    Store Information, Contacts & Logistics
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Updates here immediately sync website headers, footers, Contact page, Google Maps, and checkout policies.
                  </p>
                </div>
                {settingsSavedSuccess && (
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Settings Saved</span>
                  </div>
                )}
              </div>

              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSettingsSaving(true);
                  setAdminError(null);
                  try {
                    await updateSettings(settingsForm);
                    setSettingsSavedSuccess(true);
                    setTimeout(() => setSettingsSavedSuccess(false), 3500);
                  } catch (err: any) {
                    console.error('Failed to save settings:', err);
                    setAdminError(err?.message || 'Failed to save store settings to Firestore.');
                  } finally {
                    setSettingsSaving(false);
                  }
                }}
                className="space-y-6 text-xs"
              >
                {/* 1. Identity & Physical Location */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-bold uppercase tracking-widest text-[#D6B16D]">
                    1. Business Identity & Physical Store Address
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-neutral-300 mb-1 font-medium">Business Name</label>
                      <input
                        type="text"
                        value={settingsForm.businessName}
                        onChange={(e) => setSettingsForm({ ...settingsForm, businessName: e.target.value })}
                        required
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-300 mb-1 font-medium">Official Contact Email</label>
                      <input
                        type="email"
                        value={settingsForm.email}
                        onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                        required
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-neutral-300 mb-1 font-medium">Physical Store Address</label>
                    <input
                      type="text"
                      value={settingsForm.storeAddress}
                      onChange={(e) => setSettingsForm({ ...settingsForm, storeAddress: e.target.value })}
                      required
                      className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                    />
                    <span className="text-[10px] text-neutral-500 block mt-1">Exact location displayed on Google Maps card and invoices.</span>
                  </div>
                </div>

                {/* 2. Direct Channels (Phone & WhatsApp) */}
                <div className="space-y-3 pt-3 border-t border-[#1f1910]">
                  <h5 className="text-[11px] font-bold uppercase tracking-widest text-[#D6B16D]">
                    2. Phone & WhatsApp Concierge
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-neutral-300 mb-1 font-medium">Customer Phone Number</label>
                      <input
                        type="text"
                        value={settingsForm.phone}
                        onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                        required
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-300 mb-1 font-medium">WhatsApp Number (e.g. +92 317 8113817)</label>
                      <input
                        type="text"
                        value={settingsForm.whatsappNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          const cleanDigits = val.replace(/[^0-9]/g, '');
                          setSettingsForm({ 
                            ...settingsForm, 
                            whatsappNumber: val,
                            whatsappUrl: `https://wa.me/${cleanDigits}` 
                          });
                        }}
                        required
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Social Media URLs */}
                <div className="space-y-3 pt-3 border-t border-[#1f1910]">
                  <h5 className="text-[11px] font-bold uppercase tracking-widest text-[#D6B16D]">
                    3. Social Media Profiles (Instagram & TikTok)
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-neutral-300 mb-1 font-medium">Instagram Profile URL</label>
                      <input
                        type="url"
                        value={settingsForm.instagramUrl}
                        onChange={(e) => setSettingsForm({ ...settingsForm, instagramUrl: e.target.value })}
                        required
                        placeholder="https://www.instagram.com/yourhandle"
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-300 mb-1 font-medium">TikTok Profile URL</label>
                      <input
                        type="url"
                        value={settingsForm.tiktokUrl}
                        onChange={(e) => setSettingsForm({ ...settingsForm, tiktokUrl: e.target.value })}
                        required
                        placeholder="https://www.tiktok.com/@yourhandle"
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Shipping Logistics & Rates */}
                <div className="space-y-3 pt-3 border-t border-[#1f1910]">
                  <h5 className="text-[11px] font-bold uppercase tracking-widest text-[#D6B16D]">
                    4. Shipping Fees & Delivery Timelines
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-neutral-300 mb-1 font-medium">Free Delivery Threshold (PKR)</label>
                      <input
                        type="number"
                        value={settingsForm.freeShippingThreshold}
                        onChange={(e) => setSettingsForm({ 
                          ...settingsForm, 
                          freeShippingThreshold: Number(e.target.value),
                          shippingThreshold: Number(e.target.value)
                        })}
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-300 mb-1 font-medium">Karachi Delivery Fee (PKR)</label>
                      <input
                        type="number"
                        value={settingsForm.shippingRateKarachi}
                        onChange={(e) => setSettingsForm({ ...settingsForm, shippingRateKarachi: Number(e.target.value) })}
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-300 mb-1 font-medium">Nationwide Delivery Fee (PKR)</label>
                      <input
                        type="number"
                        value={settingsForm.shippingRateNationwide}
                        onChange={(e) => setSettingsForm({ 
                          ...settingsForm, 
                          shippingRateNationwide: Number(e.target.value),
                          standardShippingFee: Number(e.target.value)
                        })}
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-neutral-300 mb-1 font-medium">Estimated Karachi Delivery</label>
                      <input
                        type="text"
                        value={settingsForm.deliveryTimeKarachi}
                        onChange={(e) => setSettingsForm({ ...settingsForm, deliveryTimeKarachi: e.target.value })}
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-300 mb-1 font-medium">Estimated Nationwide Delivery</label>
                      <input
                        type="text"
                        value={settingsForm.deliveryTimeNationwide}
                        onChange={(e) => setSettingsForm({ ...settingsForm, deliveryTimeNationwide: e.target.value })}
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Pakistani Payment Accounts (Easypaisa, JazzCash & Meezan Bank) */}
                <div className="space-y-4 pt-4 border-t border-[#1f1910]">
                  <div>
                    <h5 className="text-[11px] font-bold uppercase tracking-widest text-[#D6B16D]">
                      5. Pakistani Payment Accounts & Merchant Details
                    </h5>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Configure your real Easypaisa, JazzCash, and Bank Transfer accounts shown to customers during checkout.
                    </p>
                  </div>

                  {/* Easypaisa */}
                  <div className="p-4 rounded-xl bg-[#110e09] border border-[#261e12] space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Easypaisa Mobile Account</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-neutral-300 mb-1 font-medium text-[11px]">Account Title</label>
                        <input
                          type="text"
                          value={settingsForm.easypaisaTitle || ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, easypaisaTitle: e.target.value })}
                          placeholder="e.g. ZN Jewelers"
                          className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-300 mb-1 font-medium text-[11px]">Mobile Account Number</label>
                        <input
                          type="text"
                          value={settingsForm.easypaisaNumber || ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, easypaisaNumber: e.target.value })}
                          placeholder="e.g. 0317 8113817"
                          className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D6B16D]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-neutral-300 mb-1 font-medium text-[11px]">Customer Instructions (Easypaisa)</label>
                      <input
                        type="text"
                        value={settingsForm.easypaisaInstructions || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, easypaisaInstructions: e.target.value })}
                        placeholder="Instructions displayed to customer..."
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                  </div>

                  {/* JazzCash */}
                  <div className="p-4 rounded-xl bg-[#110e09] border border-[#261e12] space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">JazzCash Mobile Account & Till</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-neutral-300 mb-1 font-medium text-[11px]">Account Title</label>
                        <input
                          type="text"
                          value={settingsForm.jazzcashTitle || ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, jazzcashTitle: e.target.value })}
                          placeholder="e.g. ZN Jewelers"
                          className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-300 mb-1 font-medium text-[11px]">Mobile Account Number</label>
                        <input
                          type="text"
                          value={settingsForm.jazzcashNumber || ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, jazzcashNumber: e.target.value })}
                          placeholder="e.g. 0317 8113817"
                          className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D6B16D]"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-300 mb-1 font-medium text-[11px]">Till ID (Optional)</label>
                        <input
                          type="text"
                          value={settingsForm.jazzcashTillId || ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, jazzcashTillId: e.target.value })}
                          placeholder="e.g. 00289140"
                          className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D6B16D]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-neutral-300 mb-1 font-medium text-[11px]">Customer Instructions (JazzCash)</label>
                      <input
                        type="text"
                        value={settingsForm.jazzcashInstructions || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, jazzcashInstructions: e.target.value })}
                        placeholder="Instructions displayed to customer..."
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                  </div>

                  {/* Bank Transfer (Meezan Bank) */}
                  <div className="p-4 rounded-xl bg-[#110e09] border border-[#261e12] space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Bank Transfer (Meezan Bank / 1Link Raast)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-neutral-300 mb-1 font-medium text-[11px]">Bank Name</label>
                        <input
                          type="text"
                          value={settingsForm.bankName || ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, bankName: e.target.value })}
                          placeholder="e.g. Meezan Bank Ltd"
                          className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-300 mb-1 font-medium text-[11px]">Account Title</label>
                        <input
                          type="text"
                          value={settingsForm.bankAccountTitle || ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, bankAccountTitle: e.target.value })}
                          placeholder="e.g. ZN Jewelers"
                          className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-neutral-300 mb-1 font-medium text-[11px]">Account Number</label>
                        <input
                          type="text"
                          value={settingsForm.bankAccountNumber || ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, bankAccountNumber: e.target.value })}
                          placeholder="e.g. 0108746201"
                          className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D6B16D]"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-300 mb-1 font-medium text-[11px]">IBAN Number</label>
                        <input
                          type="text"
                          value={settingsForm.bankIban || ''}
                          onChange={(e) => setSettingsForm({ ...settingsForm, bankIban: e.target.value })}
                          placeholder="e.g. PK42MEZN0099320108746201"
                          className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D6B16D]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-neutral-300 mb-1 font-medium text-[11px]">Branch Name / Location</label>
                      <input
                        type="text"
                        value={settingsForm.bankBranch || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, bankBranch: e.target.value })}
                        placeholder="e.g. Korangi Crossing Branch, Karachi"
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-[#1f1910] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-[11px] text-neutral-500">
                    Synced automatically with Firestore document <code className="text-[#D6B16D]">settings/general</code>.
                  </span>
                  <button
                    type="submit"
                    disabled={settingsSaving}
                    className="w-full sm:w-auto px-6 py-2.5 bg-[#D6B16D] text-black text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-[#F4E0A5] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{settingsSaving ? 'Saving to Store...' : 'Save Store Settings'}</span>
                  </button>
                </div>
              </form>

              {/* 6. Private Server-Side Automatic WhatsApp Order Alerts */}
              <div className="pt-6 border-t border-[#261f13] space-y-4 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h5 className="text-[11px] font-bold uppercase tracking-widest text-[#D6B16D] flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5" />
                      <span>6. Free Automatic WhatsApp Order Alerts (Instant Notification)</span>
                    </h5>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Receive automatic WhatsApp alerts on your phone whenever a customer places an order—100% FREE with no monthly subscription.
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-mono font-semibold shrink-0 self-start sm:self-center ${
                      alertStatus?.directWa?.status === 'connected' || alertStatus?.configured
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {alertStatus?.directWa?.status === 'connected'
                      ? `Connected · ${alertStatus.directWa.connectedPhone || 'Active'}`
                      : alertStatus?.configured
                      ? `Active · ${alertStatus.activeProvider}`
                      : 'Not Connected'}
                  </span>
                </div>

                {/* 100% FREE Built-in Direct WhatsApp QR Connect */}
                <div className="p-4 sm:p-5 rounded-xl bg-[#141009] border border-[#322717] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-emerald-400">
                        <span>100% Free · Built-In Direct Link</span>
                      </div>
                      <h6 className="text-sm font-serif font-semibold text-white mt-0.5">
                        Direct WhatsApp QR Link (Zero API Charges)
                      </h6>
                      <p className="text-[11px] text-neutral-300 mt-1 leading-relaxed">
                        Connect your store WhatsApp directly inside this dashboard—zero TextMeBot/Twilio fees. Just scan the QR code once from <strong>WhatsApp → Linked Devices → Link a Device</strong>.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {alertStatus?.directWa?.status === 'connected' ? (
                        <button
                          type="button"
                          disabled={waConnecting}
                          onClick={async () => {
                            if (!user) return;
                            setWaConnecting(true);
                            setAlertFeedback(null);
                            try {
                              const idToken = await user.getIdToken();
                              const res = await fetch('/api/admin/alerts/whatsapp-qr/disconnect', {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${idToken}` },
                              });
                              if (res.ok) {
                                setAlertStatus(await res.json());
                                setAlertFeedback({ ok: true, text: 'WhatsApp disconnected.' });
                              }
                            } finally {
                              setWaConnecting(false);
                            }
                          }}
                          className="px-3.5 py-2 rounded-lg bg-rose-950/70 border border-rose-700/70 text-rose-200 text-[11px] font-semibold hover:bg-rose-900 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {waConnecting ? 'Disconnecting...' : 'Disconnect WhatsApp'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={waConnecting}
                          onClick={async () => {
                            if (!user) return;
                            setWaConnecting(true);
                            setAlertFeedback(null);
                            try {
                              const idToken = await user.getIdToken();
                              const res = await fetch('/api/admin/alerts/whatsapp-qr/connect', {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${idToken}` },
                              });
                              const data = await res.json();
                              if (res.ok) {
                                setAlertStatus(data);
                              } else {
                                setAlertFeedback({ ok: false, text: data?.error || 'Could not start WhatsApp QR session.' });
                              }
                            } catch (err: any) {
                              setAlertFeedback({ ok: false, text: err?.message || 'Connection error.' });
                            } finally {
                              setWaConnecting(false);
                            }
                          }}
                          className="px-4 py-2 rounded-lg bg-[#D6B16D] hover:bg-[#F4E0A5] text-black text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow"
                        >
                          {waConnecting || alertStatus?.directWa?.status === 'connecting' ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <QrCode className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {alertStatus?.directWa?.status === 'qr_ready'
                              ? 'Refresh QR Code'
                              : alertStatus?.directWa?.status === 'connecting'
                              ? 'Connecting WhatsApp...'
                              : 'Connect Free WhatsApp (Show QR)'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Live QR Code Display */}
                  {alertStatus?.directWa?.status === 'qr_ready' && alertStatus.directWa.qrDataUrl && (
                    <div className="pt-3 border-t border-[#292014] flex flex-col sm:flex-row items-center gap-5">
                      <div className="p-3 bg-white rounded-xl shadow-lg shrink-0">
                        <img
                          src={alertStatus.directWa.qrDataUrl}
                          alt="Scan WhatsApp QR Code"
                          className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                        />
                      </div>
                      <div className="space-y-2 text-[11px] text-neutral-300 leading-relaxed">
                        <p className="text-xs font-bold text-[#D6B16D]">Scan This QR Code From Your Mobile WhatsApp:</p>
                        <ol className="list-decimal list-inside space-y-1 text-neutral-200">
                          <li>Open <strong>WhatsApp</strong> on your phone.</li>
                          <li>Tap <strong>Menu (⋮)</strong> or <strong>Settings</strong> → <strong>Linked Devices</strong>.</li>
                          <li>Tap <strong>Link a Device</strong> and point your camera at this QR code.</li>
                          <li>Wait 3–5 seconds—this box will automatically show <strong>Connected</strong>!</li>
                        </ol>
                        <p className="text-[10px] text-neutral-400">
                          Once linked, every customer order automatically sends a WhatsApp message to your Owner Number below—100% free.
                        </p>
                      </div>
                    </div>
                  )}

                  {alertStatus?.directWa?.status === 'connecting' && !alertStatus.directWa.qrDataUrl && (
                    <div className="pt-2 flex items-center gap-2 text-[11px] text-[#D6B16D]">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Initializing secure WhatsApp link... QR code will appear in a moment.</span>
                    </div>
                  )}

                  {alertStatus?.directWa?.status === 'connected' && (
                    <div className="pt-2 border-t border-[#292014] flex flex-wrap items-center gap-2 text-[11px] text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Free WhatsApp linked to <strong>{alertStatus.directWa.connectedPhone || 'Your Device'}</strong>
                        {alertStatus.directWa.connectedName ? ` (${alertStatus.directWa.connectedName})` : ''}. Automatic order alerts are LIVE!
                      </span>
                    </div>
                  )}

                  {alertStatus?.directWa?.lastError && (
                    <div className="pt-2 flex items-start gap-2 text-[11px] text-amber-300">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>{alertStatus.directWa.lastError}</span>
                    </div>
                  )}
                </div>

                {/* Owner Destination Phone Number */}
                <div>
                  <label className="block text-neutral-300 mb-1 font-medium text-[11px]">
                    Owner WhatsApp Number (Where Order Alerts Will Be Received)
                  </label>
                  <input
                    type="text"
                    value={alertOwnerPhone}
                    onChange={(e) => setAlertOwnerPhone(e.target.value)}
                    placeholder="+92 317 8113817"
                    className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D6B16D]"
                  />
                </div>

                {/* Optional External APIs Collapsible */}
                <details className="rounded-xl bg-[#100d07] border border-[#261f13] p-3">
                  <summary className="cursor-pointer text-[11px] font-semibold text-neutral-400 hover:text-[#D6B16D] select-none">
                    Optional Backup Gateways (Webhook / CallMeBot / TextMeBot API)
                  </summary>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-neutral-300 font-medium text-[11px]">
                          CallMeBot API Key
                        </label>
                        {alertStatus?.hasCallMeBotKey && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!user) return;
                              setAlertSaving(true);
                              setAlertFeedback(null);
                              try {
                                const idToken = await user.getIdToken();
                                const res = await fetch('/api/admin/alerts/config', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${idToken}`,
                                  },
                                  body: JSON.stringify({ clearCallMeBot: true }),
                                });
                                if (res.ok) {
                                  setAlertStatus(await res.json());
                                  setAlertCallMeBotKey('');
                                }
                              } finally {
                                setAlertSaving(false);
                              }
                            }}
                            className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                          >
                            Clear Saved ({alertStatus.callMeBotKeyMasked})
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        value={alertCallMeBotKey}
                        onChange={(e) => setAlertCallMeBotKey(e.target.value)}
                        placeholder={
                          alertStatus?.hasCallMeBotKey
                            ? `Saved (${alertStatus.callMeBotKeyMasked}) — enter to replace`
                            : 'Optional CallMeBot key...'
                        }
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-neutral-300 font-medium text-[11px]">
                          TextMeBot API Key
                        </label>
                        {alertStatus?.hasTextMeBotKey && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!user) return;
                              setAlertSaving(true);
                              setAlertFeedback(null);
                              try {
                                const idToken = await user.getIdToken();
                                const res = await fetch('/api/admin/alerts/config', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${idToken}`,
                                  },
                                  body: JSON.stringify({ clearTextMeBot: true }),
                                });
                                if (res.ok) {
                                  setAlertStatus(await res.json());
                                  setAlertTextMeBotKey('');
                                }
                              } finally {
                                setAlertSaving(false);
                              }
                            }}
                            className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                          >
                            Clear Saved ({alertStatus.textMeBotKeyMasked})
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        value={alertTextMeBotKey}
                        onChange={(e) => setAlertTextMeBotKey(e.target.value)}
                        placeholder={
                          alertStatus?.hasTextMeBotKey
                            ? `Saved (${alertStatus.textMeBotKeyMasked}) — enter to replace`
                            : 'Optional TextMeBot key...'
                        }
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-neutral-300 font-medium text-[11px]">
                          Custom Webhook URL (Make / Zapier / n8n)
                        </label>
                        {alertStatus?.hasWebhookUrl && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!user) return;
                              setAlertSaving(true);
                              setAlertFeedback(null);
                              try {
                                const idToken = await user.getIdToken();
                                const res = await fetch('/api/admin/alerts/config', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${idToken}`,
                                  },
                                  body: JSON.stringify({ clearWebhook: true }),
                                });
                                if (res.ok) {
                                  setAlertStatus(await res.json());
                                  setAlertWebhookUrl('');
                                }
                              } finally {
                                setAlertSaving(false);
                              }
                            }}
                            className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                          >
                            Clear Saved ({alertStatus.webhookMasked})
                          </button>
                        )}
                      </div>
                      <input
                        type="url"
                        value={alertWebhookUrl}
                        onChange={(e) => setAlertWebhookUrl(e.target.value)}
                        placeholder={
                          alertStatus?.hasWebhookUrl
                            ? `Saved (${alertStatus.webhookMasked}) — enter to replace`
                            : 'https://hook.make.com/...'
                        }
                        className="w-full bg-[#15110a] border border-[#3b2e1b] rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                  </div>
                </details>

                {alertFeedback && (
                  <div
                    className={`p-3 rounded-lg text-[11px] flex items-start gap-2 ${
                      alertFeedback.ok
                        ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-200'
                        : 'bg-rose-950/80 border border-rose-700 text-rose-200'
                    }`}
                  >
                    {alertFeedback.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <span>{alertFeedback.text}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={alertSaving || alertTesting}
                    onClick={async () => {
                      if (!user) return;
                      setAlertSaving(true);
                      setAlertFeedback(null);
                      try {
                        const idToken = await user.getIdToken();
                        const res = await fetch('/api/admin/alerts/config', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${idToken}`,
                          },
                          body: JSON.stringify({
                            ownerWhatsappPhone: alertOwnerPhone.trim(),
                            callMeBotApiKey: alertCallMeBotKey.trim() || undefined,
                            textMeBotApiKey: alertTextMeBotKey.trim() || undefined,
                            whatsappWebhookUrl: alertWebhookUrl.trim() || undefined,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          setAlertFeedback({ ok: false, text: data?.error || 'Could not save alert settings.' });
                        } else {
                          setAlertStatus(data);
                          setAlertCallMeBotKey('');
                          setAlertTextMeBotKey('');
                          setAlertWebhookUrl('');
                          setAlertFeedback({
                            ok: true,
                            text: data.configured
                              ? `Alert credentials saved securely on server (Active provider: ${data.activeProvider}). Click "Send Test WhatsApp Message" to verify delivery.`
                              : 'Owner phone updated. Paste a CallMeBot/TextMeBot key or Webhook URL above to enable automatic notifications.',
                          });
                        }
                      } catch (err: any) {
                        setAlertFeedback({ ok: false, text: err?.message || 'Network error while saving alert settings.' });
                      } finally {
                        setAlertSaving(false);
                      }
                    }}
                    className="px-4 py-2.5 rounded-lg bg-[#1c160c] border border-[#D6B16D]/60 text-[#D6B16D] text-xs font-semibold uppercase tracking-wider hover:bg-[#D6B16D] hover:text-black transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{alertSaving ? 'Saving Alerts...' : 'Save Alert Config'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={alertSaving || alertTesting}
                    onClick={async () => {
                      if (!user) return;
                      setAlertTesting(true);
                      setAlertFeedback(null);
                      try {
                        const idToken = await user.getIdToken();
                        if (
                          alertCallMeBotKey.trim() ||
                          alertTextMeBotKey.trim() ||
                          alertWebhookUrl.trim() ||
                          alertOwnerPhone.trim()
                        ) {
                          const saveRes = await fetch('/api/admin/alerts/config', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${idToken}`,
                            },
                            body: JSON.stringify({
                              ownerWhatsappPhone: alertOwnerPhone.trim(),
                              callMeBotApiKey: alertCallMeBotKey.trim() || undefined,
                              textMeBotApiKey: alertTextMeBotKey.trim() || undefined,
                              whatsappWebhookUrl: alertWebhookUrl.trim() || undefined,
                            }),
                          });
                          if (saveRes.ok) {
                            setAlertStatus(await saveRes.json());
                            setAlertCallMeBotKey('');
                            setAlertTextMeBotKey('');
                            setAlertWebhookUrl('');
                          }
                        }

                        const res = await fetch('/api/admin/alerts/test', {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${idToken}` },
                        });
                        const data = await res.json();
                        setAlertFeedback({
                          ok: Boolean(data?.ok),
                          text: data?.detail || (data?.ok ? 'Test WhatsApp message dispatched!' : 'Failed to dispatch test WhatsApp message.'),
                        });
                      } catch (err: any) {
                        setAlertFeedback({ ok: false, text: err?.message || 'Unable to run test dispatch.' });
                      } finally {
                        setAlertTesting(false);
                      }
                    }}
                    className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{alertTesting ? 'Sending Test...' : 'Send Test WhatsApp Message'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
            </div>
          </div>
        )}

      </div>

      {/* OFFICIAL COMMERCIAL INVOICE PREVIEW MODAL */}
      {selectedInvoiceOrder && (
        <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto print:bg-white print:p-0 print:block">
          <div className="relative w-full max-w-2xl bg-[#0e0c08] border border-[#D6B16D]/60 rounded-2xl p-4 sm:p-8 shadow-2xl space-y-5 text-white my-1 sm:my-4 max-h-[94dvh] overflow-y-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none">
            {/* Header with Print & Close */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#292014]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#18130a] border border-[#D6B16D]/50 flex items-center justify-center text-[#D6B16D] shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base sm:text-lg text-white">Commercial Purchase Invoice</h3>
                  <p className="text-xs text-neutral-400">ZN JEWELLERS Official Order Documentation</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-[#D6B16D] text-black text-xs font-semibold hover:bg-[#F4E0A5] transition-colors flex items-center gap-1.5 shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceOrder(null)}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Invoice Meta Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#141009] p-4 rounded-xl border border-[#2b2114]">
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-[#D6B16D] font-bold block">Merchant Details</span>
                <p className="font-serif font-bold text-white text-sm">ZN JEWELLERS</p>
                <p className="text-neutral-400">Shop No. 47, Aman Tower, Korangi Crossing</p>
                <p className="text-neutral-400">Karachi, Sindh, Pakistan</p>
                <p className="text-neutral-400">Phone / WhatsApp: <strong className="text-neutral-200 font-mono">+92 317 8113817</strong></p>
              </div>

              <div className="space-y-1 sm:text-right">
                <span className="text-[10px] uppercase tracking-wider text-[#D6B16D] font-bold block">Invoice / Order Details</span>
                <p className="font-mono font-bold text-white text-sm">{selectedInvoiceOrder.orderNumber}</p>
                <p className="text-neutral-400">Date: {formatDate(selectedInvoiceOrder.createdAt)}</p>
                <p className="text-neutral-400">
                  Payment: <strong className="text-white capitalize">{selectedInvoiceOrder.paymentMethod.replace('_', ' ')}</strong>
                </p>
                <p className="text-neutral-400">
                  Status: <span className="text-[#D6B16D] font-bold uppercase">{selectedInvoiceOrder.orderStatus}</span>
                </p>
                {selectedInvoiceOrder.trackingNumber && (
                  <p className="text-neutral-400">
                    Courier: <strong className="text-emerald-400 font-mono">{selectedInvoiceOrder.trackingNumber}</strong>
                  </p>
                )}
              </div>
            </div>

            {/* Customer Information */}
            <div className="p-3.5 rounded-xl bg-[#141009] border border-[#241a10] text-xs space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-[#D6B16D] font-bold block">Ship To Customer</span>
              <p className="font-medium text-white">{selectedInvoiceOrder.customerName}</p>
              <p className="text-neutral-400 font-mono">{selectedInvoiceOrder.customerPhone} {selectedInvoiceOrder.customerEmail && `• ${selectedInvoiceOrder.customerEmail}`}</p>
              <p className="text-neutral-300">{selectedInvoiceOrder.shippingAddress}, {selectedInvoiceOrder.city}, Pakistan</p>
            </div>

            {/* Mobile Item Cards (No Horizontal Table Overflow) */}
            <div className="sm:hidden print:hidden space-y-2.5">
              {selectedInvoiceOrder.items.map((it, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-[#141009] border border-[#292014]">
                  <img
                    src={it.image || '/hero-steel.jpg'}
                    alt={it.name}
                    className="w-12 h-12 object-cover rounded-lg border border-[#3b2e1b] bg-black shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/hero-steel.jpg'; }}
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <span className="font-serif font-medium text-white text-xs block leading-snug">{it.name}</span>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-neutral-400">
                      <span className="font-mono">SKU: {it.sku}</span>
                      {it.selectedSize && <span>• Size: {it.selectedSize}</span>}
                    </div>
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="font-mono text-neutral-300">{it.quantity} × {formatPKR(it.price)}</span>
                      <span className="font-mono font-semibold text-[#D6B16D]">{formatPKR(it.price * it.quantity)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Line Items Table with Photos (Desktop & Print) */}
            <div className="hidden sm:block print:block rounded-xl border border-[#292014] overflow-hidden bg-[#0c0a07]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-left text-xs">
                <thead className="bg-[#17120a] border-b border-[#292014] text-neutral-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Photo</th>
                    <th className="p-3">Product Description</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e170e]">
                  {selectedInvoiceOrder.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-[#141009] transition-colors">
                      <td className="p-3">
                        <img
                          src={it.image || '/hero-steel.jpg'}
                          alt={it.name}
                          className="w-12 h-12 object-cover rounded-lg border border-[#3b2e1b] bg-black"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/hero-steel.jpg'; }}
                        />
                      </td>
                      <td className="p-3">
                        <span className="font-serif font-medium text-white block">{it.name}</span>
                        <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5">
                          <span className="font-mono">SKU: {it.sku}</span>
                          {it.selectedSize && <span>• Size: {it.selectedSize}</span>}
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-white">{it.quantity}</td>
                      <td className="p-3 text-right font-mono text-neutral-300">{formatPKR(it.price)}</td>
                      <td className="p-3 text-right font-mono font-semibold text-[#D6B16D]">
                        {formatPKR(it.price * it.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className="p-4 rounded-xl bg-[#141009] border border-[#2b2114] space-y-2 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Subtotal:</span>
                <span className="font-mono text-neutral-200">{formatPKR(selectedInvoiceOrder.subtotal || selectedInvoiceOrder.total)}</span>
              </div>
              {(selectedInvoiceOrder.discount || 0) > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>
                    Promo Discount{selectedInvoiceOrder.appliedPromo ? ` (${selectedInvoiceOrder.appliedPromo})` : ''}:
                  </span>
                  <span className="font-mono">- {formatPKR(selectedInvoiceOrder.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-neutral-400">
                <span>Courier Express Shipping (Pakistan):</span>
                <span className="font-mono text-neutral-200">
                  {selectedInvoiceOrder.shippingCost === 0 ? 'FREE' : formatPKR(selectedInvoiceOrder.shippingCost)}
                </span>
              </div>
              <div className="pt-2 border-t border-[#292014] flex justify-between text-sm font-bold">
                <span className="text-white">Total Amount (PKR):</span>
                <span className="font-mono text-[#D6B16D] text-base">{formatPKR(selectedInvoiceOrder.total)}</span>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="text-[10px] text-neutral-500 text-center space-y-1">
              <p>Authentic ZN JEWELLERS creations • 7-day parcel inspection guarantee upon delivery.</p>
              <p>Need support? Contact customer concierge via WhatsApp at +92 317 8113817.</p>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK TOAST FOR ACTIONS */}
      {deleteFeedback && (
        <div className="fixed top-6 right-6 z-[110] p-3.5 bg-emerald-950/95 border border-emerald-500 text-emerald-200 text-xs rounded-xl shadow-2xl flex items-center gap-2 animate-fadeIn backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{deleteFeedback}</span>
        </div>
      )}

      {/* IN-APP CONFIRMATION MODAL FOR DELETIONS */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-[#120f0a] border border-[#D6B16D]/50 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-white text-base">
                  {deleteConfirmTarget.type === 'product' ? 'Delete Product' : 'Delete Collection'}
                </h4>
                <p className="text-xs text-neutral-400">
                  {deleteConfirmTarget.type === 'product' ? 'Store Catalogue & Inventory' : 'Storefront Collection'}
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">"{deleteConfirmTarget.name}"</strong>? This item will be removed immediately from your live website.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#261f14]">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 rounded-lg text-xs text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = deleteConfirmTarget;
                  setDeleteConfirmTarget(null);
                  try {
                    if (target.type === 'product') {
                      await deleteProduct(target.id);
                      setDeleteFeedback(`Product "${target.name}" removed successfully.`);
                    } else {
                      await deleteCollection(target.id);
                      setDeleteFeedback(`Collection "${target.name}" removed successfully.`);
                    }
                    setTimeout(() => setDeleteFeedback(null), 3500);
                  } catch (err: any) {
                    setAdminError(err?.message || `Could not delete "${target.name}". Verify admin permissions.`);
                  }
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg uppercase tracking-wider transition-colors shadow-lg"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT PROOF SCREENSHOT MODAL */}
      {previewProofUrl && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setPreviewProofUrl(null)}
        >
          <div
            className="relative max-w-lg w-full bg-[#120f0a] border border-[#D6B16D]/50 rounded-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#261f14] pb-2">
              <span className="text-xs font-serif font-semibold text-white">Customer Payment Receipt</span>
              <button
                type="button"
                onClick={() => setPreviewProofUrl(null)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={previewProofUrl}
              alt="Payment Transfer Receipt"
              className="w-full max-h-[75vh] object-contain rounded-lg bg-black"
            />
          </div>
        </div>
      )}

    </div>
  );
};
