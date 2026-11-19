import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CartItem, Product } from '../types';
import { useStoreSettings } from './StoreSettingsContext';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number, selectedSize?: string) => void;
  removeFromCart: (productId: string, selectedSize?: string) => void;
  updateQuantity: (productId: string, quantity: number, selectedSize?: string) => void;
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

  useEffect(() => {
    try {
      localStorage.setItem('zn_cart', JSON.stringify(items));
    } catch (e) {
      console.warn('LocalStorage cart error', e);
    }
  }, [items]);

  const addToCart = (product: Product, quantity: number = 1, selectedSize?: string) => {
    if (product.stock <= 0) return;
    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (item) => item.product.id === product.id && item.selectedSize === selectedSize
      );

      if (existingIndex > -1) {
        const existingItem = prevItems[existingIndex];
        const newQty = Math.min(existingItem.quantity + quantity, product.stock);
        const updated = [...prevItems];
        updated[existingIndex] = { ...existingItem, product, quantity: newQty };
        return updated;
      } else {
        const initialQty = Math.min(quantity, Math.max(1, product.stock));
        return [...prevItems, { product, quantity: initialQty, selectedSize }];
      }
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string, selectedSize?: string) => {
    setItems((prevItems) =>
      prevItems.filter(
        (item) => !(item.product.id === productId && item.selectedSize === selectedSize)
      )
    );
  };

  const updateQuantity = (productId: string, quantity: number, selectedSize?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, selectedSize);
      return;
    }
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.product.id === productId && item.selectedSize === selectedSize) {
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
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = items.reduce((sum, item) => {
    const itemPrice = item.product.salePrice ?? item.product.price;
    return sum + itemPrice * item.quantity;
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

  const total = Math.max(0, subtotal - discountAmount + shippingCost);

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
