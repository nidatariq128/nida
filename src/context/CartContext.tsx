import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { CartItem, GiftPackagingOption, Product } from '../types';
import { DEFAULT_GIFT_PACKAGING_OPTIONS, useStoreSettings } from './StoreSettingsContext';

interface CartContextType {
  items: CartItem[];
  addToCart: (
    product: Product,
    quantity?: number,
    selectedSize?: string,
    selectedColor?: string,
    selectedImage?: string,
    customNote?: string
  ) => void;
  removeFromCart: (
    productId: string,
    selectedSize?: string,
    selectedColor?: string,
    selectedImage?: string,
    customNote?: string
  ) => void;
  updateQuantity: (
    productId: string,
    quantity: number,
    selectedSize?: string,
    selectedColor?: string,
    selectedImage?: string,
    customNote?: string
  ) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  shippingCost: number;
  calculateShippingForCity: (city: string) => number;
  freeShippingThreshold: number;
  discount: number;
  appliedPromo: string | null;
  applyPromoCode: (code: string) => Promise<{ success: boolean; message: string }>;
  removePromoCode: () => void;
  giftPackagingOptions: GiftPackagingOption[];
  selectedGiftPackagingId: string;
  setSelectedGiftPackagingId: (id: string) => void;
  selectedGiftPackaging: GiftPackagingOption | null;
  giftPackagingFee: number;
  giftMessage: string;
  setGiftMessage: (msg: string) => void;
  hideGiftPrice: boolean;
  setHideGiftPrice: (hide: boolean) => void;
  total: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useStoreSettings();

  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('zn_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  const [selectedGiftPackagingId, setSelectedGiftPackagingId] = useState<string>(() => {
    try {
      return localStorage.getItem('zn_gift_packaging_id') || 'pkg-standard';
    } catch {
      return 'pkg-standard';
    }
  });

  const [giftMessage, setGiftMessage] = useState<string>(() => {
    try {
      return localStorage.getItem('zn_gift_message') || '';
    } catch {
      return '';
    }
  });

  const [hideGiftPrice, setHideGiftPrice] = useState<boolean>(() => {
    try {
      return localStorage.getItem('zn_hide_gift_price') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('zn_cart', JSON.stringify(items));
    } catch (e) {
      console.warn('LocalStorage cart error', e);
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem('zn_gift_packaging_id', selectedGiftPackagingId);
      localStorage.setItem('zn_gift_message', giftMessage);
      localStorage.setItem('zn_hide_gift_price', hideGiftPrice ? '1' : '0');
    } catch {
      // Ignore storage failures
    }
  }, [selectedGiftPackagingId, giftMessage, hideGiftPrice]);

  const activeGiftPackagingOptions = useMemo(() => {
    const raw = Array.isArray(settings.giftPackagingOptions)
      ? settings.giftPackagingOptions
      : DEFAULT_GIFT_PACKAGING_OPTIONS;
    const active = raw.filter((o) => o && o.active !== false);
    return active;
  }, [settings.giftPackagingOptions]);

  const selectedGiftPackaging = useMemo(() => {
    if (activeGiftPackagingOptions.length === 0) return null;
    return (
      activeGiftPackagingOptions.find((o) => o.id === selectedGiftPackagingId) ||
      activeGiftPackagingOptions[0]
    );
  }, [activeGiftPackagingOptions, selectedGiftPackagingId]);

  const giftPackagingFee = useMemo(() => {
    if (items.length === 0 || !selectedGiftPackaging) return 0;
    return Math.max(0, Number(selectedGiftPackaging.price) || 0);
  }, [items.length, selectedGiftPackaging]);

  const isSameVariant = (
    item: CartItem,
    productId: string,
    selectedSize?: string,
    selectedColor?: string,
    selectedImage?: string,
    customNote?: string
  ) => {
    const itemImg = item.selectedImage || item.product.images?.[0] || '';
    const targetImg = selectedImage || item.product.images?.[0] || '';
    return (
      item.product.id === productId &&
      (item.selectedSize || '') === (selectedSize || '') &&
      (item.selectedColor || '') === (selectedColor || '') &&
      itemImg === targetImg &&
      (item.customNote || '').trim() === (customNote || '').trim()
    );
  };

  const addToCart = (
    product: Product,
    quantity: number = 1,
    selectedSize?: string,
    selectedColor?: string,
    selectedImage?: string,
    customNote?: string
  ) => {
    if (product.stock <= 0) return;
    const resolvedImage = selectedImage || product.images?.[0];
    const resolvedColor = selectedColor?.trim() || undefined;
    const resolvedCustomNote = customNote?.trim().slice(0, 160) || undefined;
    const resolvedCustomFee =
      resolvedCustomNote &&
      product.allowCustomization &&
      typeof product.customizationFee === 'number' &&
      product.customizationFee > 0
        ? product.customizationFee
        : undefined;

    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex((item) =>
        isSameVariant(item, product.id, selectedSize, resolvedColor, resolvedImage, resolvedCustomNote)
      );

      if (existingIndex > -1) {
        const existingItem = prevItems[existingIndex];
        const newQty = Math.min(existingItem.quantity + quantity, product.stock);
        const updated = [...prevItems];
        updated[existingIndex] = {
          ...existingItem,
          product,
          quantity: newQty,
          selectedColor: resolvedColor,
          selectedImage: resolvedImage,
          customNote: resolvedCustomNote,
          customizationFee: resolvedCustomFee,
        };
        return updated;
      } else {
        const initialQty = Math.min(quantity, Math.max(1, product.stock));
        return [
          ...prevItems,
          {
            product,
            quantity: initialQty,
            selectedSize,
            selectedColor: resolvedColor,
            selectedImage: resolvedImage,
            customNote: resolvedCustomNote,
            customizationFee: resolvedCustomFee,
          },
        ];
      }
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (
    productId: string,
    selectedSize?: string,
    selectedColor?: string,
    selectedImage?: string,
    customNote?: string
  ) => {
    setItems((prevItems) =>
      prevItems.filter(
        (item) => !isSameVariant(item, productId, selectedSize, selectedColor, selectedImage, customNote)
      )
    );
  };

  const updateQuantity = (
    productId: string,
    quantity: number,
    selectedSize?: string,
    selectedColor?: string,
    selectedImage?: string,
    customNote?: string
  ) => {
    if (quantity <= 0) {
      removeFromCart(productId, selectedSize, selectedColor, selectedImage, customNote);
      return;
    }
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (isSameVariant(item, productId, selectedSize, selectedColor, selectedImage, customNote)) {
          const clampedQty = Math.min(quantity, item.product.stock);
          return { ...item, quantity: clampedQty };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setItems([]);
    setAppliedPromo(null);
    setDiscountAmount(0);
    setGiftMessage('');
    setHideGiftPrice(false);
    setSelectedGiftPackagingId(activeGiftPackagingOptions[0]?.id || 'pkg-standard');
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = items.reduce((sum, item) => {
    const basePrice = item.product.salePrice ?? item.product.price;
    const customFee = item.customNote
      ? Math.max(0, Number(item.customizationFee ?? item.product.customizationFee ?? 0) || 0)
      : 0;
    return sum + (basePrice + customFee) * item.quantity;
  }, 0);

  const freeShippingThreshold =
    typeof settings.freeShippingThreshold === 'number' ? settings.freeShippingThreshold : 5000;

  const calculateShippingForCity = useCallback(
    (city: string) => {
      if (items.length === 0) return 0;
      const net = Math.max(0, subtotal - discountAmount);
      if (net >= freeShippingThreshold) return 0;
      const isKarachi = city.trim().toLowerCase() === 'karachi';
      return isKarachi
        ? settings.shippingRateKarachi ?? 200
        : settings.shippingRateNationwide ?? settings.standardShippingFee ?? 250;
    },
    [items.length, subtotal, discountAmount, freeShippingThreshold, settings]
  );

  const shippingCost = calculateShippingForCity('Karachi');

  // Re-validate applied promo code whenever cart subtotal changes
  useEffect(() => {
    if (!appliedPromo) {
      if (discountAmount !== 0) setDiscountAmount(0);
      return;
    }
    if (subtotal <= 0) {
      setAppliedPromo(null);
      setDiscountAmount(0);
      return;
    }

    let cancelled = false;
    fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: appliedPromo, subtotal }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.valid) {
          setDiscountAmount(Number(data.discount) || 0);
        } else {
          setAppliedPromo(null);
          setDiscountAmount(0);
        }
      })
      .catch(() => {
        // Keep current discount if transient network issue
      });

    return () => {
      cancelled = true;
    };
  }, [subtotal, appliedPromo]);

  const applyPromoCode = async (
    code: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: 'Please enter a promotional code.' };
    }
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode, subtotal }),
      });
      const data = await res.json();
      if (res.ok && data?.valid) {
        setAppliedPromo(data.code || cleanCode);
        setDiscountAmount(Number(data.discount) || 0);
        return { success: true, message: data.message || 'Promo code applied!' };
      }
      return {
        success: false,
        message: data?.message || 'Invalid or expired promotional code.',
      };
    } catch {
      return {
        success: false,
        message: 'Unable to validate promotional code right now. Please try again.',
      };
    }
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
    setDiscountAmount(0);
  };

  const total = Math.max(0, subtotal - discountAmount + shippingCost + giftPackagingFee);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
        shippingCost,
        calculateShippingForCity,
        freeShippingThreshold,
        discount: discountAmount,
        appliedPromo,
        applyPromoCode,
        removePromoCode,
        giftPackagingOptions: activeGiftPackagingOptions,
        selectedGiftPackagingId: selectedGiftPackaging?.id || selectedGiftPackagingId,
        setSelectedGiftPackagingId,
        selectedGiftPackaging,
        giftPackagingFee,
        giftMessage,
        setGiftMessage,
        hideGiftPrice,
        setHideGiftPrice,
        total,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
