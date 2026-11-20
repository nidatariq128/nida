import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  ShoppingBag, 
  ArrowRight, 
  Truck, 
  Gift, 
  Tag, 
  CheckCircle2, 
  AlertCircle,
  ZoomIn 
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { GiftPackagingOption } from '../../types';
import { formatPKR } from '../../lib/formatters';

interface CartDrawerProps {
  onProceedToCheckout: () => void;
  onExploreProducts: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  onProceedToCheckout,
  onExploreProducts
}) => {
  const {
    items,
    removeFromCart,
    updateQuantity,
    subtotal,
    shippingCost,
    freeShippingThreshold,
    discount,
    appliedPromo,
    applyPromoCode,
    removePromoCode,
    giftPackagingOptions,
    selectedGiftPackaging,
    setSelectedGiftPackagingId,
    giftPackagingFee,
    giftMessage,
    setGiftMessage,
    hideGiftPrice,
    setHideGiftPrice,
    total,
    isCartOpen,
    setIsCartOpen
  } = useCart();

  const [promoInput, setPromoInput] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewBox, setPreviewBox] = useState<GiftPackagingOption | null>(null);

  if (!isCartOpen) return null;

  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const freeShippingProgress = Math.min(100, (subtotal / freeShippingThreshold) * 100);
  const hasStockIssue = items.some((i) => i.product.stock <= 0 || i.quantity > i.product.stock);

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim() || applyingPromo) return;
    setApplyingPromo(true);
    try {
      const res = await applyPromoCode(promoInput);
      if (res.success) {
        setPromoMessage({ type: 'success', text: res.message });
        setPromoInput('');
      } else {
        setPromoMessage({ type: 'error', text: res.message });
      }
    } finally {
      setApplyingPromo(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-sm flex justify-end transition-opacity"
      onClick={() => setIsCartOpen(false)}
    >
      <div
        className="w-full max-w-md h-full bg-[#0a0805] border-l border-[#2e2417] flex flex-col justify-between shadow-2xl text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-4 border-b border-[#211a10] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingBag className="w-5 h-5 text-[#D6B16D] shrink-0" />
            <h3 className="text-sm sm:text-base font-serif font-medium tracking-wide truncate">
              Your Shopping Bag ({items.reduce((s, i) => s + i.quantity, 0)})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            aria-label="Close Shopping Bag"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-neutral-400 hover:text-white rounded-full hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Complimentary Shipping Progress Banner */}
        <div className="bg-[#120e08] border-b border-[#211a10] px-4 sm:px-5 py-3 space-y-1.5 shrink-0">
          <div className="flex items-start gap-2 text-xs text-neutral-300">
            <Truck className="w-3.5 h-3.5 text-[#D6B16D] shrink-0 mt-0.5" />
            <span className="flex-1 min-w-0 leading-snug">
              {remainingForFreeShipping > 0 ? (
                <span>
                  Add <strong className="text-[#D6B16D] font-mono tabular-nums">{formatPKR(remainingForFreeShipping)}</strong> for Complimentary Insured Delivery
                </span>
              ) : (
                <span className="text-emerald-400 font-medium">
                  Complimentary Insured Courier Unlocked!
                </span>
              )}
            </span>
          </div>
          <div className="w-full bg-[#20180d] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#D6B16D] to-[#F4E0A5] h-full rounded-full transition-all duration-500"
              style={{ width: `${freeShippingProgress}%` }}
            />
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
                <div className="w-16 h-16 rounded-full bg-[#18130a] border border-[#3b2e1b] flex items-center justify-center text-[#D6B16D]">
                  <ShoppingBag className="w-8 h-8 opacity-60" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-serif font-medium text-white">Your bag is empty</h4>
                  <p className="text-xs text-neutral-400 max-w-xs">
                    Explore our luxury watches, bridal bangles, designer handbags, and waterproof steel jewellery to discover treasures.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    onExploreProducts();
                  }}
                  className="px-6 py-2.5 bg-[#D6B16D] text-black text-xs font-semibold uppercase tracking-wider rounded hover:bg-[#F4E0A5] transition-colors"
                >
                  Discover Collections
                </button>
              </div>
            ) : (
              items.map((item, index) => {
                const customFee = item.customNote
                  ? Math.max(0, Number(item.customizationFee ?? item.product.customizationFee ?? 0) || 0)
                  : 0;
                const unitEffective = (item.product.salePrice ?? item.product.price) + customFee;
                return (
                <div
                  key={`${item.product.id}-${item.selectedSize || 'std'}-${item.selectedColor || 'def'}-${index}`}
                  className="p-3 sm:p-3.5 rounded-xl bg-[#100d08] border border-[#241c11] flex gap-3 relative group"
                >
                  {/* Thumbnail */}
                  <img
                    src={item.selectedImage || item.product.images[0] || '/hero-steel.jpg'}
                    alt={item.selectedColor ? `${item.product.name} (${item.selectedColor})` : item.product.name}
                    className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg bg-[#18130a] border border-[#2b2114] shrink-0"
                    onError={(e) => {
                      const el = e.currentTarget;
                      if (!el.dataset.fallbackApplied) {
                        el.dataset.fallbackApplied = '1';
                        el.src = '/hero-steel.jpg';
                      }
                    }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-serif font-semibold text-white truncate">
                        {item.product.name}
                      </h4>
                      <button
                        type="button"
                        onClick={() =>
                          removeFromCart(
                            item.product.id,
                            item.selectedSize,
                            item.selectedColor,
                            item.selectedImage,
                            item.customNote
                          )
                        }
                        className="text-neutral-500 hover:text-red-400 transition-colors p-1 shrink-0"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-neutral-400">
                      <span>{item.product.category}</span>
                      {item.selectedColor && (
                        <span>
                          • Color: <strong className="text-[#D6B16D]">{item.selectedColor}</strong>
                        </span>
                      )}
                      {item.selectedSize && (
                        <span>
                          • Size: <strong className="text-neutral-200">{item.selectedSize}</strong>
                        </span>
                      )}
                    </div>

                    {item.customNote && (
                      <div className="text-[10px] text-[#F4E0A5] bg-[#1a1409] border border-[#3a2d18] rounded px-2 py-1 leading-snug break-words">
                        <span className="text-neutral-400">Custom:</span> "{item.customNote}"
                        {customFee > 0 && (
                          <span className="font-mono text-[#D6B16D] ml-1.5">
                            (+{formatPKR(customFee)}/pc)
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-2">
                      {/* Quantity Stepper */}
                      <div className="flex items-center rounded bg-[#18130a] border border-[#2b2114] shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              item.product.id,
                              item.quantity - 1,
                              item.selectedSize,
                              item.selectedColor,
                              item.selectedImage,
                              item.customNote
                            )
                          }
                          className="min-w-[28px] min-h-[28px] text-xs text-neutral-400 hover:text-white flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="px-2 text-xs font-mono tabular-nums font-medium text-white">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              item.product.id,
                              item.quantity + 1,
                              item.selectedSize,
                              item.selectedColor,
                              item.selectedImage,
                              item.customNote
                            )
                          }
                          disabled={item.quantity >= item.product.stock}
                          className="min-w-[28px] min-h-[28px] text-xs text-neutral-400 hover:text-white disabled:opacity-30 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>

                      {/* Price */}
                      <span className="text-xs font-mono tabular-nums font-semibold text-[#D6B16D] shrink-0">
                        {formatPKR(unitEffective * item.quantity)}
                      </span>
                    </div>

                    {item.quantity >= item.product.stock && (
                      <span className="text-[10px] text-amber-400 block pt-0.5">
                        Max available stock reached
                      </span>
                    )}
                  </div>
                </div>
                );
              })
            )}

            {/* Gift Packaging Selector inside scrollable body */}
            {items.length > 0 && giftPackagingOptions.length > 0 && (
              <div className="p-3.5 rounded-xl bg-[#100d08] border border-[#2b2114] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-[#D6B16D] font-semibold flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 shrink-0" />
                    <span>Gift Packaging</span>
                  </span>
                  {selectedGiftPackaging && (
                    <span className="text-[11px] font-mono text-[#F4E0A5]">
                      {giftPackagingFee === 0 ? 'Complimentary' : `+ ${formatPKR(giftPackagingFee)}`}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {giftPackagingOptions.map((opt) => {
                    const isSelected = selectedGiftPackaging?.id === opt.id;
                    return (
                      <div
                        key={opt.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedGiftPackagingId(opt.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedGiftPackagingId(opt.id);
                          }
                        }}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-2.5 ${
                          isSelected
                            ? 'bg-[#1a1409] border-[#D6B16D] ring-1 ring-[#D6B16D]/30'
                            : 'bg-[#0b0906] border-[#241b0f] hover:border-[#3d311c]'
                        }`}
                      >
                        {/* Box Thumbnail */}
                        {opt.image ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewBox(opt);
                            }}
                            title="View Gift Box Photo"
                            className="relative w-12 h-12 rounded-md overflow-hidden bg-[#161109] border border-[#3b2e1b] shrink-0 group cursor-zoom-in"
                          >
                            <img
                              src={opt.image}
                              alt={opt.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded bg-black/75 text-[#D6B16D] flex items-center justify-center">
                              <ZoomIn className="w-2.5 h-2.5" />
                            </span>
                          </button>
                        ) : (
                          <div className="w-12 h-12 rounded-md bg-[#161109] border border-[#2b2114] flex items-center justify-center shrink-0">
                            <Gift className="w-5 h-5 text-[#D6B16D]/60" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-white block leading-snug truncate">
                            {opt.name}
                          </span>
                          {opt.description && (
                            <span className="text-[10px] text-neutral-400 block leading-snug mt-0.5 line-clamp-2">
                              {opt.description}
                            </span>
                          )}
                          {opt.image && (
                            <span className="text-[9px] text-[#D6B16D]/80 block mt-0.5">
                              Tap photo to preview box
                            </span>
                          )}
                        </div>

                        <div className="text-right shrink-0 space-y-0.5">
                          <span className="text-[11px] font-mono font-semibold text-[#D6B16D] block">
                            {opt.price <= 0 ? 'Free' : `+ ${formatPKR(opt.price)}`}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-semibold block">
                              Selected
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-1 space-y-2">
                  <input
                    type="text"
                    maxLength={180}
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value)}
                    placeholder="Optional Gift Card Message (e.g. Happy Anniversary!)"
                    className="w-full bg-[#0a0805] border border-[#241b0f] rounded px-2.5 py-1.5 text-[11px] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#D6B16D]"
                  />
                  <label className="flex items-center gap-2 text-[11px] text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideGiftPrice}
                      onChange={(e) => setHideGiftPrice(e.target.checked)}
                      className="accent-[#D6B16D]"
                    />
                    <span>Hide price on parcel packing slip (for gifting)</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Footer & Checkout Area */}
          {items.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-[#211a10] bg-[#0c0906] space-y-3.5 shrink-0">
              {/* Voucher Code Form */}
              <div className="space-y-1.5">
                {appliedPromo ? (
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Tag className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Code <strong>{appliedPromo}</strong> applied</span>
                    </div>
                    <button
                      type="button"
                      onClick={removePromoCode}
                      className="text-neutral-400 hover:text-white text-[11px] underline shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyPromo} className="flex items-stretch gap-2 w-full">
                    <input
                      type="text"
                      placeholder="Promo Code (e.g. ZNLUXURY10)"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                      className="min-w-0 flex-1 bg-[#141009] border border-[#2d2315] text-xs px-3 py-2 rounded text-white focus:outline-none focus:border-[#D6B16D] placeholder:text-neutral-500 uppercase"
                    />
                    <button
                      type="submit"
                      disabled={applyingPromo}
                      className="px-3.5 sm:px-4 min-h-[40px] bg-[#1f190f] border border-[#3d311c] text-[#D6B16D] text-xs font-medium rounded hover:bg-[#D6B16D] hover:text-black transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                    >
                      {applyingPromo ? '...' : 'Apply'}
                    </button>
                  </form>
                )}
                {promoMessage && (
                  <div className={`text-[11px] flex items-center gap-1 ${
                    promoMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {promoMessage.type === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="min-w-0 break-words">{promoMessage.text}</span>
                  </div>
                )}
              </div>

              {/* Price Calculations */}
              <div className="space-y-2 text-xs border-t border-[#1d160e] pt-3">
                <div className="flex items-center justify-between gap-3 text-neutral-300">
                  <span className="truncate">Subtotal</span>
                  <span className="font-mono tabular-nums text-white shrink-0">{formatPKR(subtotal)}</span>
                </div>

                {discount > 0 && (
                  <div className="flex items-center justify-between gap-3 text-emerald-400 font-medium">
                    <span className="truncate">Privilege Voucher</span>
                    <span className="font-mono tabular-nums shrink-0">- {formatPKR(discount)}</span>
                  </div>
                )}

                {selectedGiftPackaging && (
                  <div className="flex items-center justify-between gap-3 text-neutral-300">
                    <span className="truncate">Gift Packaging ({selectedGiftPackaging.name})</span>
                    <span className="font-mono tabular-nums text-white shrink-0">
                      {giftPackagingFee === 0 ? 'Complimentary' : formatPKR(giftPackagingFee)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 text-neutral-300">
                  <span className="truncate">{shippingCost === 0 ? 'Insured Armored Courier' : 'Courier Shipping (Karachi Est.)'}</span>
                  <span className="font-mono tabular-nums text-white shrink-0">
                    {shippingCost === 0 ? 'Complimentary' : formatPKR(shippingCost)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-base font-serif font-semibold text-white pt-2 border-t border-[#261d12]">
                  <span>Total Payable</span>
                  <span className="font-mono tabular-nums text-[#D6B16D] shrink-0">{formatPKR(total)}</span>
                </div>
              </div>

              {hasStockIssue && (
                <div className="p-2 rounded bg-rose-950/70 border border-rose-500/40 text-[11px] text-rose-200 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>One or more items exceed available stock. Please adjust quantities before checkout.</span>
                </div>
              )}

              {/* Checkout Trigger */}
              <button
                type="button"
                disabled={hasStockIssue}
                onClick={() => {
                  setIsCartOpen(false);
                  onProceedToCheckout();
                }}
                className="w-full min-h-[46px] py-3 px-4 bg-gradient-to-r from-[#D6B16D] via-[#F4E0A5] to-[#C29B53] text-black font-semibold text-xs uppercase tracking-[0.14em] sm:tracking-[0.2em] rounded hover:shadow-[0_0_25px_rgba(214,177,109,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Proceed To Secure Checkout</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          )}
      </div>

      {/* Gift Box Photo Preview Lightbox */}
      {previewBox && previewBox.image && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewBox(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#100d08] border border-[#3b2e1b] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-black">
              <img
                src={previewBox.image}
                alt={previewBox.name}
                className="w-full max-h-[60vh] object-contain"
              />
              <button
                type="button"
                onClick={() => setPreviewBox(null)}
                aria-label="Close Preview"
                className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/80 text-white hover:text-[#D6B16D] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-sm font-serif font-semibold text-white">{previewBox.name}</h4>
                  {previewBox.description && (
                    <p className="text-xs text-neutral-400 mt-0.5">{previewBox.description}</p>
                  )}
                </div>
                <span className="text-xs font-mono font-bold text-[#D6B16D] shrink-0">
                  {previewBox.price <= 0 ? 'Free' : `+ ${formatPKR(previewBox.price)}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedGiftPackagingId(previewBox.id);
                  setPreviewBox(null);
                }}
                className="w-full py-2.5 rounded-lg bg-[#D6B16D] text-black text-xs font-bold uppercase tracking-wider hover:bg-[#F4E0A5] transition-colors cursor-pointer"
              >
                Select This Box ({previewBox.price <= 0 ? 'Free' : `+ ${formatPKR(previewBox.price)}`})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
