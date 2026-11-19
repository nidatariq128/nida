import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowLeft,
  ArrowRight,
  Truck,
  CheckCircle2,
  Building2,
  CreditCard,
  Copy,
  Sparkles,
  Printer,
  MessageCircle,
  AlertCircle,
  Check,
  Upload,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useProducts } from '../../context/ProductContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { PaymentMethod, Order } from '../../types';
import { formatPKR } from '../../lib/formatters';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewOrderTracking: (orderNumber: string, phone: string) => void;
}

const isValidPakistanPhone = (raw: string): boolean => {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 10 || digits.length > 14) return false;
  let local = digits;
  if (local.startsWith('0092')) local = local.slice(4);
  else if (local.startsWith('92') && local.length >= 12) local = local.slice(2);
  else if (local.startsWith('0')) local = local.slice(1);
  return /^3[0-9]{9}$/.test(local) || digits.length >= 10;
};

const compressReceiptImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 900;
        let w = img.width;
        let h = img.height;
        if (w > h && w > MAX_DIM) {
          h *= MAX_DIM / w;
          w = MAX_DIM;
        } else if (h >= w && h > MAX_DIM) {
          w *= MAX_DIM / h;
          h = MAX_DIM;
        }
        canvas.width = Math.round(w);
        canvas.height = Math.round(h);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(ev.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onViewOrderTracking,
}) => {
  const { items, subtotal, discount, appliedPromo, calculateShippingForCity, clearCart } =
    useCart();
  const { user, profile } = useAuth();
  const { applyStockUpdates } = useProducts();
  const { settings } = useStoreSettings();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [submitting, setSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceCopied, setInvoiceCopied] = useState(false);
  const [whatsappAutoPushed, setWhatsappAutoPushed] = useState(false);
  const [customerWhatsappNotified, setCustomerWhatsappNotified] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [onlineCardConfigured, setOnlineCardConfigured] = useState<boolean>(false);

  // Form Fields
  const [fullName, setFullName] = useState(profile?.displayName || user?.displayName || '');
  const [email, setEmail] = useState(profile?.email || user?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');

  // Step 2: Shipping
  const [country] = useState('Pakistan');
  const [city, setCity] = useState('Karachi');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Step 3: Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('easypaisa');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | undefined>(undefined);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Dynamic city-aware shipping & total
  const activeShippingCost = calculateShippingForCity(city);
  const activeTotal = Math.max(0, subtotal - discount + activeShippingCost);

  // Reset modal & check payment gateway capability when opened
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCompletedOrder(null);
      setValidationError(null);
      setShowInvoiceModal(false);
      setInvoiceCopied(false);
      setWhatsappAutoPushed(false);
      setPaymentProofUrl(undefined);
      setIdempotencyKey(`ord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

      if (profile?.displayName && !fullName) setFullName(profile.displayName);
      if ((profile?.email || user?.email) && !email) setEmail(profile?.email || user?.email || '');
      if (profile?.phone && !phone) setPhone(profile.phone);
      if (profile?.addresses?.[0]?.street && !address) {
        setAddress(profile.addresses[0].street);
        if (profile.addresses[0].city) setCity(profile.addresses[0].city);
      }

      fetch('/api/payments/config')
        .then((r) => r.json())
        .then((cfg) => {
          setOnlineCardConfigured(Boolean(cfg?.onlineCardConfigured));
        })
        .catch(() => setOnlineCardConfigured(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyText = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    setValidationError(null);
    try {
      const dataUrl = await compressReceiptImage(file);
      if (dataUrl.length > 340000) {
        setValidationError('Receipt screenshot is too large. Please upload an image under 250KB.');
      } else {
        setPaymentProofUrl(dataUrl);
      }
    } catch {
      setValidationError('Could not process receipt image. Please try another screenshot.');
    } finally {
      setUploadingProof(false);
      e.target.value = '';
    }
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0 || submitting) return;

    if (paymentMethod === 'online_card' && !onlineCardConfigured) {
      setValidationError(
        'Online card gateway is not configured on this store yet. Please choose Easypaisa, JazzCash, Bank Transfer, or Cash on Delivery.'
      );
      return;
    }

    setSubmitting(true);
    setValidationError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user) {
        try {
          const token = await user.getIdToken();
          headers.Authorization = `Bearer ${token}`;
        } catch {
          // Proceed as signed/guest
        }
      }

      const fullAddress = postalCode.trim()
        ? `${address.trim()}, ${city} (${postalCode.trim()}), ${country}`
        : `${address.trim()}, ${city}, ${country}`;

      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerName: fullName.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim(),
          shippingAddress: fullAddress,
          city,
          paymentMethod,
          paymentReference: paymentReference.trim() || undefined,
          paymentProofUrl,
          notes: deliveryNotes.trim() || undefined,
          promoCode: appliedPromo || undefined,
          idempotencyKey,
          items: items.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            selectedSize: i.selectedSize,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setValidationError(data?.error || 'Could not place order. Please review your details.');
        setSubmitting(false);
        return;
      }

      const serverOrder = data.order as Order;
      const stockUpdates = (data.stockUpdates || {}) as Record<string, number>;
      const persistedInFirestore = Boolean(data.persistedInFirestore);
      setWhatsappAutoPushed(Boolean(data?.whatsappAlert?.autoPushed));
      setCustomerWhatsappNotified(Boolean(data?.whatsappAlert?.customerAutoNotified));

      // Update client catalog stock immediately from server transaction result
      applyStockUpdates(stockUpdates);

      // Keep local receipt convenience copy for OrderTracking quick-pick & offline fallback
      try {
        const existing = JSON.parse(localStorage.getItem('zn_orders') || '[]');
        const updatedList = [
          serverOrder,
          ...existing.filter((o: Order) => o.orderNumber !== serverOrder.orderNumber),
        ];
        localStorage.setItem('zn_orders', JSON.stringify(updatedList.slice(0, 20)));
        localStorage.setItem('zn_last_order', JSON.stringify(serverOrder));
      } catch (e) {
        console.warn('Local order receipt note:', e);
      }

      // Mirror strictly rule-compliant order document to Firestore when Admin SDK isn't configured
      if (!persistedInFirestore) {
        try {
          const cleanOrder: Record<string, unknown> = {
            id: serverOrder.orderNumber,
            orderNumber: serverOrder.orderNumber,
            userId: user?.uid || 'guest',
            customerName: serverOrder.customerName,
            customerEmail: serverOrder.customerEmail,
            customerPhone: serverOrder.customerPhone,
            shippingAddress: serverOrder.shippingAddress,
            city: serverOrder.city,
            items: serverOrder.items.map((it) => {
              const obj: Record<string, unknown> = {
                productId: it.productId,
                name: it.name,
                sku: it.sku,
                price: it.price,
                quantity: it.quantity,
                image: it.image,
              };
              if (it.selectedSize) obj.selectedSize = it.selectedSize;
              return obj;
            }),
            subtotal: serverOrder.subtotal,
            shippingCost: serverOrder.shippingCost,
            discount: serverOrder.discount,
            total: serverOrder.total,
            paymentMethod: serverOrder.paymentMethod,
            paymentStatus: 'pending',
            orderStatus: 'Order Placed',
            createdAt: serverOrder.createdAt,
          };
          if (serverOrder.appliedPromo) cleanOrder.appliedPromo = serverOrder.appliedPromo;
          if (serverOrder.paymentReference) cleanOrder.paymentReference = serverOrder.paymentReference;
          if (serverOrder.paymentProofUrl) cleanOrder.paymentProofUrl = serverOrder.paymentProofUrl;
          if (serverOrder.notes) cleanOrder.notes = serverOrder.notes;
          if (serverOrder.idempotencyKey) cleanOrder.idempotencyKey = serverOrder.idempotencyKey;

          await setDoc(doc(db, 'orders', serverOrder.orderNumber), cleanOrder);
        } catch (fsErr) {
          console.warn('Firestore order sync note:', fsErr);
        }
      }

      setCompletedOrder(serverOrder);
      clearCart();
      setStep(5);

      try {
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#D6B16D', '#F4E0A5', '#FFF', '#9E7426'],
        });
      } catch {
        // Confetti fallback
      }
    } catch (err) {
      console.error('Order placement failed:', err);
      setValidationError('Network error while placing order. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    setShowInvoiceModal(true);
  };

  const storePhoneDisplay = settings.phone || '+92 317 8113817';
  const storeWhatsappDigits = settings.whatsappNumber.replace(/[^0-9]/g, '') || '923178113817';

  const handleCopyInvoiceText = (ord: Order) => {
    const text =
      `========================================\n` +
      `ZN JEWELERS - OFFICIAL FORMAL INVOICE\n` +
      `${settings.storeAddress}\n` +
      `Phone: ${storePhoneDisplay} | WhatsApp: ${storePhoneDisplay}\n` +
      `Email: ${settings.email}\n` +
      `========================================\n` +
      `Invoice / Order ID : ${ord.orderNumber}\n` +
      `Order Date         : ${new Date(ord.createdAt).toLocaleDateString('en-GB')}\n` +
      `Customer Name      : ${ord.customerName}\n` +
      `Mobile Number      : ${ord.customerPhone}\n` +
      `Delivery Address   : ${ord.shippingAddress}\n` +
      `City               : ${ord.city}, Pakistan\n` +
      `----------------------------------------\n` +
      `PURCHASED PRODUCTS:\n` +
      ord.items
        .map(
          (i, idx) =>
            `[${idx + 1}] ${i.name}${i.selectedSize ? ` (Size: ${i.selectedSize})` : ''} (Qty: ${i.quantity}) - Rs. ${(i.price * i.quantity).toLocaleString()}`
        )
        .join('\n') +
      `\n----------------------------------------\n` +
      `Subtotal           : Rs. ${ord.subtotal.toLocaleString()}\n` +
      (ord.discount ? `Discount           : - Rs. ${ord.discount.toLocaleString()}\n` : '') +
      `Insured Delivery   : ${ord.shippingCost === 0 ? 'Complimentary Free' : `Rs. ${ord.shippingCost.toLocaleString()}`}\n` +
      `TOTAL PAYABLE      : Rs. ${ord.total.toLocaleString()}\n` +
      `Payment Method     : ${ord.paymentMethod.toUpperCase().replace('_', ' ')}\n` +
      `Payment Status     : ${ord.paymentStatus.toUpperCase()}\n` +
      (ord.paymentReference ? `Payment TRX / Ref  : ${ord.paymentReference}\n` : '') +
      `Order Status       : ${ord.orderStatus}\n` +
      `========================================\n` +
      `Thank you for shopping at ZN Jewelers!`;

    navigator.clipboard.writeText(text);
    setInvoiceCopied(true);
    setTimeout(() => setInvoiceCopied(false), 2500);
  };

  const getWhatsAppOrderConfirmationUrl = (ord: Order) => {
    const itemsLines = ord.items
      .map(
        (i, idx) =>
          `${idx + 1}. ${i.name} (${i.sku}) x${i.quantity} — Rs. ${(i.price * i.quantity).toLocaleString()}`
      )
      .join('\n');

    const message =
      `*OFFICIAL ORDER INVOICE - ZN JEWELERS*\n\n` +
      `*Order ID:* ${ord.orderNumber}\n` +
      `*Date:* ${new Date(ord.createdAt).toLocaleDateString('en-GB')}\n` +
      `*Customer:* ${ord.customerName}\n` +
      `*Phone:* ${ord.customerPhone}\n` +
      `*Address:* ${ord.shippingAddress}\n\n` +
      `*Ordered Items:*\n${itemsLines}\n\n` +
      `*Subtotal:* Rs. ${ord.subtotal.toLocaleString()}\n` +
      (ord.discount ? `*Discount:* - Rs. ${ord.discount.toLocaleString()}\n` : '') +
      `*Courier:* ${ord.shippingCost === 0 ? 'Free' : `Rs. ${ord.shippingCost.toLocaleString()}`}\n` +
      `*Total Amount:* Rs. ${ord.total.toLocaleString()}\n` +
      `*Payment Method:* ${ord.paymentMethod.toUpperCase().replace('_', ' ')}\n` +
      (ord.paymentReference ? `*Payment Reference / TRX ID:* ${ord.paymentReference}\n` : '') +
      `\nPlease verify payment and dispatch my order. Thank you!`;
    return `https://wa.me/${storeWhatsappDigits}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-start sm:items-center justify-center p-2 sm:p-6">
      <div
        className="relative w-full max-w-3xl bg-[#0c0a07] border border-[#3b301c] rounded-2xl shadow-2xl overflow-hidden my-1 sm:my-4 max-h-[94dvh] flex flex-col text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-3.5 sm:p-5 border-b border-[#211a10] flex items-center justify-between bg-[#110e09] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#D6B16D] font-medium">
              ZN Jewelers
            </span>
            <span className="text-neutral-500">•</span>
            <h3 className="text-sm sm:text-base font-serif font-semibold tracking-wide">
              {step === 5 ? 'Order Placed & Confirmed' : 'Secure Checkout'}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close checkout"
            className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator (Steps 1 to 4) */}
        {step < 5 && (
          <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-[#080705] border-b border-[#1c160e] flex items-center justify-between gap-1.5 text-xs shrink-0">
            <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-[#D6B16D]' : 'text-neutral-600'}`}>
              <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold shrink-0">
                1
              </span>
              <span className="hidden sm:inline">Customer Info</span>
            </div>
            <span className="h-px flex-1 bg-[#221b11]" />
            <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-[#D6B16D]' : 'text-neutral-600'}`}>
              <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold shrink-0">
                2
              </span>
              <span className="hidden sm:inline">Delivery Address</span>
            </div>
            <span className="h-px flex-1 bg-[#221b11]" />
            <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-[#D6B16D]' : 'text-neutral-600'}`}>
              <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold shrink-0">
                3
              </span>
              <span className="hidden sm:inline">Payment (PKR)</span>
            </div>
            <span className="h-px flex-1 bg-[#221b11]" />
            <div className={`flex items-center gap-1.5 ${step >= 4 ? 'text-[#D6B16D]' : 'text-neutral-600'}`}>
              <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold shrink-0">
                4
              </span>
              <span className="hidden sm:inline">Review</span>
            </div>
          </div>
        )}

        {/* Inline Error Notice */}
        {validationError && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 bg-red-950/80 border border-red-500/60 text-red-200 text-xs rounded-lg flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Step Content */}
        <div className="p-4 sm:p-7 flex-1 overflow-y-auto space-y-5">
          {/* STEP 1: Customer Information */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-lg font-serif font-medium text-white">Customer Information</h4>
                <p className="text-xs text-neutral-400">
                  Please enter your contact details. We will send your Order ID and delivery tracking updates here.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    required
                    placeholder="e.g. Fatima Ali / Muhammad Tariq"
                    className="w-full bg-[#130f0a] border border-[#2d2417] rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#D6B16D]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-300 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      required
                      placeholder="customer@email.com"
                      className="w-full bg-[#130f0a] border border-[#2d2417] rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#D6B16D]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-300 mb-1">
                      Mobile / WhatsApp Number *
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      required
                      placeholder="0317 8113817"
                      className="w-full bg-[#130f0a] border border-[#2d2417] rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#D6B16D]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Delivery Address */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-lg font-serif font-medium text-white">Delivery Address</h4>
                <p className="text-xs text-neutral-400">
                  We deliver across Karachi ({settings.deliveryTimeKarachi}) and nationwide across Pakistan ({settings.deliveryTimeNationwide}).
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-300 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={country}
                      disabled
                      className="w-full bg-[#130f0a] border border-[#2d2417] rounded-lg px-4 py-2.5 text-xs text-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-300 mb-1">
                      City *
                    </label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-[#130f0a] border border-[#2d2417] rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#D6B16D]"
                    >
                      <option value="Karachi">
                        Karachi (₨ {settings.shippingRateKarachi} or Free over ₨ {settings.freeShippingThreshold.toLocaleString()})
                      </option>
                      <option value="Lahore">Lahore</option>
                      <option value="Islamabad">Islamabad</option>
                      <option value="Rawalpindi">Rawalpindi</option>
                      <option value="Faisalabad">Faisalabad</option>
                      <option value="Multan">Multan</option>
                      <option value="Peshawar">Peshawar</option>
                      <option value="Quetta">Quetta</option>
                      <option value="Sialkot">Sialkot</option>
                      <option value="Hyderabad">Hyderabad</option>
                      <option value="Gujranwala">Gujranwala</option>
                      <option value="Other Pakistan City">Other Pakistan City</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-300 mb-1">
                    Complete Street / House Address *
                  </label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    required
                    placeholder="House/Apartment #, Street, Area/Sector, Nearby Landmark"
                    className="w-full bg-[#130f0a] border border-[#2d2417] rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#D6B16D]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-300 mb-1">
                      Postal Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="e.g. 74900"
                      className="w-full bg-[#130f0a] border border-[#2d2417] rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#D6B16D]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-300 mb-1">
                      Delivery Instructions (Optional)
                    </label>
                    <input
                      type="text"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder="e.g. Call before arrival, leave with security"
                      className="w-full bg-[#130f0a] border border-[#2d2417] rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#D6B16D]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Payment Method */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-lg font-serif font-medium text-white">Payment Method</h4>
                <p className="text-xs text-neutral-400">
                  Select your payment method. Direct Easypaisa, JazzCash, and Meezan Bank Transfer are verified by our concierge team.
                </p>
              </div>

              {/* Payment Methods Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* 1. Easypaisa */}
                <div
                  onClick={() => {
                    setPaymentMethod('easypaisa');
                    setValidationError(null);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'easypaisa'
                      ? 'bg-[#18130a] border-[#D6B16D] shadow-md ring-1 ring-[#D6B16D]/30'
                      : 'bg-[#100d08] border-[#261e13] hover:border-[#3d311c]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xs">
                      EP
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-white">Easypaisa</h5>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {settings.easypaisaNumber}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. JazzCash */}
                <div
                  onClick={() => {
                    setPaymentMethod('jazzcash');
                    setValidationError(null);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'jazzcash'
                      ? 'bg-[#18130a] border-[#D6B16D] shadow-md ring-1 ring-[#D6B16D]/30'
                      : 'bg-[#100d08] border-[#261e13] hover:border-[#3d311c]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-950/80 border border-red-500/40 flex items-center justify-center text-red-400 font-bold text-xs">
                      JC
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-white">JazzCash</h5>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {settings.jazzcashNumber}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Direct Bank Transfer */}
                <div
                  onClick={() => {
                    setPaymentMethod('bank_transfer');
                    setValidationError(null);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'bank_transfer'
                      ? 'bg-[#18130a] border-[#D6B16D] shadow-md ring-1 ring-[#D6B16D]/30'
                      : 'bg-[#100d08] border-[#261e13] hover:border-[#3d311c]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#241a0d] border border-[#D6B16D]/40 flex items-center justify-center text-[#D6B16D]">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-white">Bank Transfer ({settings.bankName})</h5>
                      <span className="text-[10px] text-neutral-400">{settings.bankName}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Cash on Delivery (COD) */}
                <div
                  onClick={() => {
                    setPaymentMethod('cod');
                    setValidationError(null);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'cod'
                      ? 'bg-[#18130a] border-[#D6B16D] shadow-md ring-1 ring-[#D6B16D]/30'
                      : 'bg-[#100d08] border-[#261e13] hover:border-[#3d311c]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#1a140d] border border-amber-600/30 flex items-center justify-center text-amber-400">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-white">Cash on Delivery (COD)</h5>
                      <span className="text-[10px] text-neutral-400">Pay cash upon delivery</span>
                    </div>
                  </div>
                </div>

                {/* 5. Online Card (Honest Gateway Check) */}
                <div
                  onClick={() => {
                    setPaymentMethod('online_card');
                    setValidationError(null);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all sm:col-span-2 ${
                    paymentMethod === 'online_card'
                      ? 'bg-[#18130a] border-[#D6B16D] shadow-md ring-1 ring-[#D6B16D]/30'
                      : 'bg-[#100d08] border-[#261e13] hover:border-[#3d311c]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#1c160d] border border-[#D6B16D]/30 flex items-center justify-center text-[#D6B16D]">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-semibold text-white">Credit / Debit Card Gateway</h5>
                        <span className="text-[10px] text-neutral-400">
                          {onlineCardConfigured
                            ? 'Verified Visa / Mastercard Checkout'
                            : 'Requires merchant gateway activation'}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        onlineCardConfigured
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : 'bg-neutral-900 text-neutral-400 border border-neutral-700'
                      }`}
                    >
                      {onlineCardConfigured ? 'Active' : 'Unavailable'}
                    </span>
                  </div>
                </div>
              </div>

              {/* REAL PAYMENT DETAILS & ACCOUNT INFORMATION */}
              <div className="p-4 sm:p-5 rounded-xl bg-[#141009] border border-[#2f2416] space-y-4">
                {/* Easypaisa Box */}
                {paymentMethod === 'easypaisa' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-[#291f13] pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs uppercase tracking-wider text-[#D6B16D] font-bold">
                          Official Easypaisa Account Details
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-400">Direct Mobile Account</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0a0805] p-3 rounded-lg border border-[#231a0e]">
                      <div>
                        <span className="text-[10px] uppercase text-neutral-500 block">
                          Account Title
                        </span>
                        <span className="font-semibold text-white text-sm">
                          {settings.easypaisaTitle || 'ZN Jewelers'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-neutral-500 block">
                          Account Number
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#D6B16D] text-sm">
                            {settings.easypaisaNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(settings.easypaisaNumber, 'ep_num')}
                            className="px-2 py-0.5 rounded bg-[#211a10] hover:bg-[#332717] text-[#D6B16D] text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            {copiedField === 'ep_num' ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedField === 'ep_num' ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-neutral-300 leading-relaxed">
                      {settings.easypaisaInstructions ||
                        'Open your Easypaisa app, transfer the order amount, and paste the 11-digit TRX ID below.'}
                    </p>

                    <div>
                      <label className="block text-[11px] text-neutral-300 mb-1 font-medium">
                        Easypaisa Transaction ID (TRX ID) / Sender Phone Number:
                      </label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="e.g. TRX 20491829141 or 0317-XXXXXXX"
                        className="w-full bg-[#0a0805] border border-[#2d2315] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                      <span className="text-[10px] text-neutral-500 mt-1 block">
                        Payment stays pending verification until our store concierge confirms the TRX ID or receipt screenshot.
                      </span>
                    </div>
                  </div>
                )}

                {/* JazzCash Box */}
                {paymentMethod === 'jazzcash' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-[#291f13] pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs uppercase tracking-wider text-[#D6B16D] font-bold">
                          Official JazzCash Account Details
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-400">Mobile Account & Till</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#0a0805] p-3 rounded-lg border border-[#231a0e]">
                      <div>
                        <span className="text-[10px] uppercase text-neutral-500 block">
                          Account Title
                        </span>
                        <span className="font-semibold text-white text-sm">
                          {settings.jazzcashTitle || 'ZN Jewelers'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-neutral-500 block">
                          Mobile Account
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#D6B16D] text-sm">
                            {settings.jazzcashNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(settings.jazzcashNumber, 'jc_num')}
                            className="px-2 py-0.5 rounded bg-[#211a10] hover:bg-[#332717] text-[#D6B16D] text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            {copiedField === 'jc_num' ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedField === 'jc_num' ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>
                      {settings.jazzcashTillId && (
                        <div>
                          <span className="text-[10px] uppercase text-neutral-500 block">
                            Till ID
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-sm">
                              {settings.jazzcashTillId}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(settings.jazzcashTillId, 'jc_till')}
                              className="px-2 py-0.5 rounded bg-[#211a10] hover:bg-[#332717] text-[#D6B16D] text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              {copiedField === 'jc_till' ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>{copiedField === 'jc_till' ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-neutral-300 leading-relaxed">
                      {settings.jazzcashInstructions ||
                        'Transfer via JazzCash App to our Mobile Number or Till ID, and paste the JazzCash TID below.'}
                    </p>

                    <div>
                      <label className="block text-[11px] text-neutral-300 mb-1 font-medium">
                        JazzCash Transaction ID (TID) / Sender Phone Number:
                      </label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="e.g. TID 984021481 or 0317-XXXXXXX"
                        className="w-full bg-[#0a0805] border border-[#2d2315] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                  </div>
                )}

                {/* Bank Transfer Box */}
                {paymentMethod === 'bank_transfer' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-[#291f13] pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-xs uppercase tracking-wider text-[#D6B16D] font-bold">
                          Official Bank Account Details
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-400">
                        1Link & Raast Instant Transfer
                      </span>
                    </div>

                    <div className="space-y-2 bg-[#0a0805] p-3.5 rounded-lg border border-[#231a0e]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] uppercase text-neutral-500 block">
                            Bank Name
                          </span>
                          <span className="font-semibold text-white">{settings.bankName}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-neutral-500 block">
                            Account Title
                          </span>
                          <span className="font-semibold text-white">
                            {settings.bankAccountTitle}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#1a140b]">
                        <div>
                          <span className="text-[10px] uppercase text-neutral-500 block">
                            Account Number
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#D6B16D]">
                              {settings.bankAccountNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(settings.bankAccountNumber, 'bank_acc')}
                              className="px-2 py-0.5 rounded bg-[#211a10] hover:bg-[#332717] text-[#D6B16D] text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              {copiedField === 'bank_acc' ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>{copiedField === 'bank_acc' ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase text-neutral-500 block">
                            IBAN (Raast / All Banks)
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-[11px] truncate">
                              {settings.bankIban}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(settings.bankIban, 'bank_iban')}
                              className="px-2 py-0.5 rounded bg-[#211a10] hover:bg-[#332717] text-[#D6B16D] text-[10px] font-medium flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                            >
                              {copiedField === 'bank_iban' ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>{copiedField === 'bank_iban' ? 'Copied' : 'Copy IBAN'}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {settings.bankBranch && (
                        <div className="pt-1 text-[11px] text-neutral-400">
                          <span>Branch: {settings.bankBranch}</span>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-neutral-300 leading-relaxed">
                      {settings.bankInstructions}
                    </p>

                    <div>
                      <label className="block text-[11px] text-neutral-300 mb-1 font-medium">
                        Online Banking Reference / Deposit Slip Number:
                      </label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="e.g. FT26042109485 / Raast Ref"
                        className="w-full bg-[#0a0805] border border-[#2d2315] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>
                  </div>
                )}

                {/* Receipt Screenshot Upload for Digital Transfers */}
                {(paymentMethod === 'easypaisa' ||
                  paymentMethod === 'jazzcash' ||
                  paymentMethod === 'bank_transfer') && (
                  <div className="pt-3 border-t border-[#261d12] space-y-2 text-xs">
                    <span className="text-[11px] text-neutral-300 font-medium block">
                      Upload Payment Proof Screenshot (Optional):
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="px-3 py-1.5 rounded-lg bg-[#211a10] hover:bg-[#332717] border border-[#3d311c] text-[#D6B16D] text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingProof ? 'Compressing...' : paymentProofUrl ? 'Replace Screenshot' : 'Attach Screenshot'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProofUpload}
                          className="hidden"
                        />
                      </label>
                      {paymentProofUrl && (
                        <div className="flex items-center gap-2 bg-[#0a0805] px-2.5 py-1 rounded-lg border border-emerald-700/50">
                          <img
                            src={paymentProofUrl}
                            alt="Payment receipt"
                            className="w-8 h-8 rounded object-cover"
                          />
                          <span className="text-[10px] text-emerald-400 font-medium">
                            Receipt Attached
                          </span>
                          <button
                            type="button"
                            onClick={() => setPaymentProofUrl(undefined)}
                            className="text-neutral-400 hover:text-red-400 p-0.5"
                            title="Remove screenshot"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* COD Box */}
                {paymentMethod === 'cod' && (
                  <div className="space-y-2 text-xs text-neutral-300">
                    <span className="text-[11px] uppercase tracking-wider text-[#D6B16D] font-bold block">
                      Cash on Delivery (COD) Guidelines:
                    </span>
                    <p className="leading-relaxed">
                      • Your parcel will be securely delivered to your address in a tamper-evident ZN Jewelers package.
                    </p>
                    <p className="leading-relaxed">
                      • Please keep the exact amount ready in cash (Rs. {activeTotal.toLocaleString()}).
                    </p>
                    <p className="leading-relaxed">
                      • Our support desk will place a quick confirmation phone call before dispatching the rider.
                    </p>
                  </div>
                )}

                {/* Online Card Box */}
                {paymentMethod === 'online_card' && (
                  <div className="space-y-2 text-xs text-neutral-300">
                    <span className="text-[11px] uppercase tracking-wider text-[#D6B16D] font-bold block">
                      Online Card Checkout:
                    </span>
                    {onlineCardConfigured ? (
                      <p className="leading-relaxed text-emerald-300">
                        Secure card checkout is active. Complete your review on the next step to confirm your order.
                      </p>
                    ) : (
                      <p className="leading-relaxed text-amber-300">
                        Merchant card credentials (`STRIPE_SECRET_KEY` / `PAYFAST_MERCHANT_ID`) are not yet configured on the server. Please select Easypaisa, JazzCash, Bank Transfer, or Cash on Delivery above.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Order Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-lg font-serif font-medium text-white">Review Your Order</h4>
                <p className="text-xs text-neutral-400">
                  Please review your item list, delivery address, and payment method.
                </p>
              </div>

              {/* Items Summary */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#110e09] border border-[#211a10]"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-11 h-11 object-cover rounded"
                      />
                      <div>
                        <h5 className="text-xs font-serif font-semibold text-white">
                          {item.product.name}
                        </h5>
                        <div className="text-[10px] text-neutral-400 flex items-center gap-2 mt-0.5">
                          <span>Qty: {item.quantity}</span>
                          {item.selectedSize && <span>• Size: {item.selectedSize}</span>}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-semibold text-[#D6B16D]">
                      {formatPKR((item.product.salePrice ?? item.product.price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Client & Shipping Review Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-lg bg-[#110e09] border border-[#211a10] space-y-1">
                  <span className="text-[10px] uppercase text-[#D6B16D] font-bold block">
                    Customer & Contact
                  </span>
                  <p className="text-white font-medium">{fullName}</p>
                  <p className="text-neutral-300 font-mono">{phone}</p>
                  <p className="text-neutral-400">{email}</p>
                </div>
                <div className="p-3.5 rounded-lg bg-[#110e09] border border-[#211a10] space-y-1">
                  <span className="text-[10px] uppercase text-[#D6B16D] font-bold block">
                    Delivery & Payment
                  </span>
                  <p className="text-white">
                    {address}, {city}
                  </p>
                  <p className="text-[#D6B16D] capitalize font-medium">
                    Payment: {paymentMethod.replace('_', ' ')}
                  </p>
                  {paymentReference && (
                    <p className="text-neutral-400 font-mono text-[11px]">
                      Ref: {paymentReference}
                    </p>
                  )}
                  {paymentProofUrl && (
                    <p className="text-emerald-400 text-[11px]">Receipt screenshot attached</p>
                  )}
                </div>
              </div>

              {/* Cost Totals */}
              <div className="p-4 rounded-xl bg-[#141009] border border-[#2a2012] space-y-2 text-xs">
                <div className="flex justify-between text-neutral-300">
                  <span>Subtotal</span>
                  <span className="font-mono text-white">{formatPKR(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-medium">
                    <span>Discount {appliedPromo ? `(${appliedPromo})` : ''}</span>
                    <span className="font-mono">- {formatPKR(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-300">
                  <span>Shipping & Delivery ({city})</span>
                  <span className="font-mono text-white">
                    {activeShippingCost === 0 ? 'Free Shipping' : formatPKR(activeShippingCost)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-serif font-semibold text-white pt-2 border-t border-[#231a0f]">
                  <span>Total Payable</span>
                  <span className="font-mono text-[#D6B16D]">{formatPKR(activeTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Order Confirmation & Receipt */}
          {step === 5 && completedOrder && (
            <div className="text-center space-y-6 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-xl">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-[0.3em] text-[#D6B16D] font-semibold">
                  Order Received • Awaiting Store Confirmation
                </span>
                <h3 className="text-2xl sm:text-3xl font-serif text-white">
                  Thank You, {completedOrder.customerName}
                </h3>
                <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
                  Your order is recorded. Once our team verifies and confirms your order, you will receive a confirmation message on WhatsApp (<span className="text-neutral-200 font-mono">{completedOrder.customerPhone}</span>) and live status on Track Order.
                </p>
              </div>

              {/* PROMINENT ORDER ID CARD */}
              <div className="max-w-md mx-auto p-5 rounded-2xl bg-gradient-to-b from-[#18130a] to-[#0e0c08] border-2 border-[#D6B16D] text-left space-y-4 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#2d2315]">
                  <div>
                    <span className="text-[10px] uppercase text-neutral-400 tracking-wider block">
                      Your Unique Order ID
                    </span>
                    <span className="text-xl sm:text-2xl font-mono font-bold text-[#D6B16D] tracking-wider">
                      {completedOrder.orderNumber}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(completedOrder.orderNumber, 'order_id')}
                    className="px-3 py-1.5 rounded-lg bg-[#D6B16D] text-black font-semibold text-xs flex items-center gap-1.5 hover:bg-[#F4E0A5] transition-all cursor-pointer shadow-md"
                  >
                    {copiedField === 'order_id' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedField === 'order_id' ? 'Copied!' : 'Copy ID'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-neutral-500 text-[10px] uppercase block">
                      Order Status
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] uppercase font-bold inline-block mt-0.5">
                      {completedOrder.orderStatus}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 text-[10px] uppercase block">
                      Payment Status
                    </span>
                    <span className="text-amber-300 capitalize font-medium">
                      {completedOrder.paymentMethod.replace('_', ' ')} ({completedOrder.paymentStatus})
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 text-[10px] uppercase block">
                      Total Amount
                    </span>
                    <span className="text-sm font-mono font-bold text-white">
                      {formatPKR(completedOrder.total)}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 text-[10px] uppercase block">
                      Contact Phone
                    </span>
                    <span className="text-white font-mono">{completedOrder.customerPhone}</span>
                  </div>
                </div>

                {completedOrder.paymentReference && (
                  <div className="p-2.5 rounded bg-[#0a0805] border border-[#241c10] text-xs">
                    <span className="text-neutral-400 text-[10px] uppercase block">
                      Your Payment Reference
                    </span>
                    <span className="font-mono text-[#D6B16D] font-medium">
                      {completedOrder.paymentReference}
                    </span>
                  </div>
                )}
              </div>

              {/* Ordered Items with Product Images */}
              <div className="max-w-md mx-auto p-4 rounded-xl bg-[#110e08] border border-[#2b2114] text-left space-y-3">
                <span className="text-[11px] uppercase tracking-wider text-[#D6B16D] font-bold block">
                  Ordered Products ({completedOrder.items.length})
                </span>
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {completedOrder.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 p-2 rounded-lg bg-[#18130b] border border-[#261d12]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={
                            it.image ||
                            'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=400&q=80'
                          }
                          alt={it.name}
                          className="w-12 h-12 object-cover rounded-md border border-[#3b2e1b] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-serif font-medium text-white truncate">
                            {it.name}
                          </p>
                          <p className="text-[10px] text-neutral-400 mt-0.5">
                            Qty: <strong className="text-neutral-200">{it.quantity}</strong>
                            {it.selectedSize ? ` • Size: ${it.selectedSize}` : ''}
                            {it.sku ? ` • SKU: ${it.sku}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-[#D6B16D] shrink-0">
                        ₨ {(it.price * it.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* INSTANT WHATSAPP ORDER DISPATCH BANNER */}
              <div className="max-w-md mx-auto p-4 rounded-xl bg-emerald-950/40 border border-emerald-600/50 text-left space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold text-emerald-200">
                      {customerWhatsappNotified
                        ? `Order receipt sent to your WhatsApp (${completedOrder.customerPhone}) & store!`
                        : whatsappAutoPushed
                        ? 'Order invoice sent to ZN Jewelers WhatsApp!'
                        : 'Send Order Summary Directly to Store WhatsApp'}
                    </p>
                    <p className="text-[11px] text-neutral-300 leading-relaxed">
                      {customerWhatsappNotified
                        ? 'You will automatically receive another WhatsApp message once ZN Jewelers confirms & dispatches your order.'
                        : <>Tap below to message your Order ID, items, address &amp; total directly to <span className="font-mono text-white">{storePhoneDisplay}</span> for instant confirmation.</>}
                    </p>
                  </div>
                </div>
                <a
                  href={getWhatsAppOrderConfirmationUrl(completedOrder)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send Order Message on WhatsApp</span>
                </a>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1 max-w-lg mx-auto">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onViewOrderTracking(completedOrder.orderNumber, completedOrder.customerPhone);
                  }}
                  className="w-full sm:w-auto px-6 py-3 bg-[#D6B16D] text-black text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-[#F4E0A5] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#D6B16D]/20"
                >
                  <Truck className="w-4 h-4" />
                  <span>Track This Order</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="w-full sm:w-auto px-4 py-3 bg-[#17130a] border border-[#3b301c] text-neutral-300 text-xs font-medium uppercase tracking-wider rounded-lg hover:text-white hover:border-[#D6B16D] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-[#D6B16D]" />
                  <span>Print Invoice</span>
                </button>
              </div>

              <div>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-neutral-400 hover:text-white text-xs uppercase tracking-wider underline cursor-pointer"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons (Steps 1 to 4) */}
        {step < 5 && (
          <div className="p-4 sm:p-5 border-t border-[#211a10] bg-[#110e09] flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setValidationError(null);
                  setStep((s) => (s - 1) as any);
                }}
                className="px-5 py-2.5 bg-[#17130a] border border-[#2b2214] text-neutral-300 text-xs font-medium rounded hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={() => {
                  setValidationError(null);
                  if (step === 1) {
                    if (!fullName.trim() || fullName.trim().length < 2) {
                      setValidationError('Please enter your full name.');
                      return;
                    }
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                      setValidationError('Please enter a valid email address.');
                      return;
                    }
                    if (!isValidPakistanPhone(phone)) {
                      setValidationError(
                        'Please enter a valid Pakistani mobile number (e.g. 0317 8113817).'
                      );
                      return;
                    }
                  }
                  if (step === 2) {
                    if (!address.trim() || address.trim().length < 5) {
                      setValidationError('Please enter your complete delivery street address.');
                      return;
                    }
                  }
                  if (step === 3 && paymentMethod === 'online_card' && !onlineCardConfigured) {
                    setValidationError(
                      'Online card gateway is not yet active. Please choose Easypaisa, JazzCash, Bank Transfer, or Cash on Delivery.'
                    );
                    return;
                  }
                  setStep((s) => (s + 1) as any);
                }}
                className="px-6 py-2.5 bg-[#D6B16D] text-black text-xs font-semibold uppercase tracking-wider rounded hover:bg-[#F4E0A5] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={submitting}
                className="px-8 py-3 bg-gradient-to-r from-[#D6B16D] via-[#F4E0A5] to-[#C29B53] text-black text-xs font-bold uppercase tracking-[0.15em] rounded hover:shadow-[0_0_25px_rgba(214,177,109,0.35)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 fill-black" />
                <span>{submitting ? 'Placing Order...' : 'Confirm & Place Order'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* FORMAL PRINTABLE DIGITAL INVOICE MODAL */}
      {showInvoiceModal && completedOrder && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-start sm:items-center justify-center p-2 sm:p-6 print:bg-white print:p-0 print:block"
          onClick={() => setShowInvoiceModal(false)}
        >
          <div
            className="relative w-full max-w-2xl bg-[#fcfbf9] text-neutral-900 rounded-2xl shadow-2xl border border-[#d6b16d]/50 overflow-hidden my-1 sm:my-4 max-h-[94dvh] flex flex-col animate-fadeIn print:shadow-none print:border-none print:my-0 print:max-h-none print:overflow-visible"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Invoice Top Action Bar */}
            <div className="p-3.5 sm:p-4 bg-[#141009] text-white flex flex-wrap items-center justify-between gap-2 border-b border-[#2d2315] shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#D6B16D] shrink-0" />
                <span className="text-xs font-serif font-bold uppercase tracking-wider text-[#D6B16D]">
                  Official Formal Invoice
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyInvoiceText(completedOrder)}
                  className="px-2.5 sm:px-3 py-1.5 rounded bg-[#241c10] hover:bg-[#382b18] text-[#D6B16D] text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {invoiceCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{invoiceCopied ? 'Copied!' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.print();
                    } catch {
                      // fallback
                    }
                  }}
                  className="px-2.5 sm:px-3 py-1.5 rounded bg-[#D6B16D] text-black text-xs font-bold uppercase tracking-wider hover:bg-[#F4E0A5] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  aria-label="Close invoice"
                  className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Invoice Sheet */}
            <div className="p-4 sm:p-8 space-y-5 text-neutral-800 text-xs font-sans flex-1 overflow-y-auto print:overflow-visible print:p-0">
              {/* Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-300 pb-5">
                <div>
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 tracking-wider">
                    ZN JEWELERS
                  </h2>
                  <p className="text-[11px] text-neutral-600 font-medium mt-0.5">
                    Fashion Jewellery & Luxury Accessories
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-1 max-w-xs">
                    {settings.storeAddress}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Phone / WhatsApp: {storePhoneDisplay}
                  </p>
                </div>

                <div className="text-left sm:text-right space-y-1">
                  <span className="px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold uppercase text-[10px] tracking-wider border border-amber-300 inline-block">
                    {completedOrder.orderStatus}
                  </span>
                  <div className="text-sm font-mono font-bold text-neutral-900">
                    Invoice: <span className="text-[#a47a28]">{completedOrder.orderNumber}</span>
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Date:{' '}
                    {new Date(completedOrder.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>

              {/* Customer & Delivery Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-100/70 p-4 rounded-xl border border-neutral-200">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider block">
                    Billed & Dispatched To:
                  </span>
                  <p className="font-bold text-neutral-900 text-sm">{completedOrder.customerName}</p>
                  <p className="text-neutral-700 font-mono text-[11px]">
                    {completedOrder.customerPhone}
                  </p>
                  <p className="text-neutral-600 text-[11px] break-all">{completedOrder.customerEmail}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider block">
                    Delivery Destination:
                  </span>
                  <p className="text-neutral-800 font-medium break-words">{completedOrder.shippingAddress}</p>
                  <p className="text-neutral-600 text-[11px]">
                    City: {completedOrder.city}, Pakistan
                  </p>
                  <p className="text-neutral-600 text-[11px] capitalize">
                    Payment Method:{' '}
                    <strong>{completedOrder.paymentMethod.replace('_', ' ')}</strong>
                  </p>
                  {completedOrder.paymentReference && (
                    <p className="text-neutral-700 font-mono text-[11px] break-all">
                      TRX / Ref ID: <strong>{completedOrder.paymentReference}</strong>
                    </p>
                  )}
                </div>
              </div>

              {/* Mobile Friendly Item List */}
              <div className="sm:hidden print:hidden space-y-2.5">
                {completedOrder.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-200"
                  >
                    <img
                      src={
                        item.image ||
                        'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=200&q=80'
                      }
                      alt={item.name}
                      className="w-12 h-12 object-cover rounded border border-neutral-300 shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-semibold text-neutral-900 text-xs leading-snug">{item.name}</p>
                      <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-neutral-500">
                        <span className="font-mono">SKU: {item.sku || 'ZN-STEEL'}</span>
                        {item.selectedSize && <span>• Size: {item.selectedSize}</span>}
                      </div>
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="font-mono text-neutral-600">
                          {item.quantity} × ₨ {item.price.toLocaleString()}
                        </span>
                        <span className="font-mono font-bold text-neutral-900">
                          ₨ {(item.price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Itemized Table (Desktop & Print) */}
              <div className="hidden sm:block print:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-neutral-300 text-[11px] font-bold uppercase tracking-wider text-neutral-600">
                      <th className="py-2 pl-1 w-12">Photo</th>
                      <th className="py-2">Item Description</th>
                      <th className="py-2 text-center">SKU</th>
                      <th className="py-2 text-center">Qty</th>
                      <th className="py-2 text-right">Unit Price</th>
                      <th className="py-2 text-right pr-1">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {completedOrder.items.map((item, idx) => (
                      <tr key={idx} className="py-2">
                        <td className="py-2.5 pl-1 pr-2">
                          <img
                            src={
                              item.image ||
                              'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=200&q=80'
                            }
                            alt={item.name}
                            className="w-11 h-11 object-cover rounded border border-neutral-300 shadow-sm"
                          />
                        </td>
                        <td className="py-2.5 pr-2 font-medium text-neutral-900">
                          {item.name}
                          {item.selectedSize && (
                            <span className="text-[10px] text-neutral-500 block">
                              Size: {item.selectedSize}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center text-neutral-500 font-mono text-[11px] whitespace-nowrap">
                          {item.sku || 'ZN-STEEL'}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-neutral-800">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-neutral-700 whitespace-nowrap">
                          ₨ {item.price.toLocaleString()}
                        </td>
                        <td className="py-2.5 pl-2 pr-1 text-right font-mono font-bold text-neutral-900 whitespace-nowrap">
                          ₨ {(item.price * item.quantity).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Calculation Totals */}
              <div className="pt-3 border-t-2 border-neutral-300 flex justify-end">
                <div className="w-full sm:w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-neutral-600">
                    <span>Subtotal</span>
                    <span className="font-mono">₨ {completedOrder.subtotal.toLocaleString()}</span>
                  </div>
                  {completedOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Discount</span>
                      <span className="font-mono">
                        - ₨ {completedOrder.discount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-neutral-600">
                    <span>Insured Courier</span>
                    <span className="font-mono">
                      {completedOrder.shippingCost === 0
                        ? 'Complimentary (Free)'
                        : `₨ ${completedOrder.shippingCost.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-neutral-900 pt-2 border-t border-neutral-300">
                    <span>Grand Total</span>
                    <span className="font-mono text-[#91691c]">
                      ₨ {completedOrder.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer Terms & Stamp */}
              <div className="pt-4 border-t border-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[10px] text-neutral-500">
                <div className="space-y-0.5">
                  <p className="font-semibold text-neutral-700">ZN Jewelers Quality Assurance:</p>
                  <p>• Premium Stainless Steel & Fashion Accessories • Anti-Tarnish & Waterproof Quality</p>
                  <p>
                    • For inquiries, contact: {storePhoneDisplay} | {settings.email}
                  </p>
                </div>
                <div className="p-2 border border-dashed border-amber-600/60 rounded text-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 block">
                    ZN ATELIER
                  </span>
                  <span className="text-[8px] text-amber-700">Official Computerized Invoice</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
