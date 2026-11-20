import React, { useState, useEffect } from 'react';
import { 
  X, 
  Heart, 
  ShoppingBag, 
  Zap, 
  ShieldCheck, 
  Truck, 
  Award, 
  Star, 
  Check, 
  Sparkles,
  Send,
  RotateCcw,
  MessageCircle
} from 'lucide-react';
import { Product, Review } from '../../types';
import { formatPKR } from '../../lib/formatters';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useProducts } from '../../context/ProductContext';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestoreErrors';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onInstantBuyNow: (
    product: Product,
    quantity: number,
    selectedSize?: string,
    selectedColor?: string,
    selectedImage?: string,
    customNote?: string
  ) => void;
  onSelectRelatedProduct: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onInstantBuyNow,
  onSelectRelatedProduct
}) => {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist, user, profile, authError, clearAuthError, loginWithGoogle } = useAuth();
  const { products } = useProducts();
  const { settings } = useStoreSettings();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);
  const [customNote, setCustomNote] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'specs' | 'reviews' | 'delivery'>('specs');
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [showSizingGuide, setShowSizingGuide] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [reviewName, setReviewName] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setActiveImageIndex(0);
      setQuantity(1);
      const sizes =
        product.sizeOptions && product.sizeOptions.length > 0
          ? product.sizeOptions
          : product.ringSizes || [];
      setSelectedSize(sizes.length > 0 ? sizes[0] : undefined);
      setCustomNote('');
      setShowSizingGuide(false);
      setReviewError(null);
      loadReviews(product.id);
    }
  }, [product]);

  const loadReviews = async (productId: string) => {
    setReviewsLoading(true);
    try {
      const q = query(collection(db, 'reviews'), where('productId', '==', productId));
      const snap = await getDocs(q);
      const list: Review[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Review));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReviews(list);
    } catch (e) {
      console.warn('Reviews fetch note:', e);
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !newComment.trim()) return;
    setReviewError(null);

    if (!user) {
      setReviewError('Please sign in with Google to post a verified patron review.');
      return;
    }

    setSubmittingReview(true);
    const revId = `rev-${Date.now()}-${user.uid.slice(0, 6)}`;
    const author = reviewName.trim() || profile?.displayName || user.displayName || 'Distinguished Patron';
    const reviewData: Review = {
      id: revId,
      productId: product.id,
      userName: author,
      userId: user.uid,
      rating: newRating,
      comment: newComment.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'reviews', revId), reviewData);
      setReviews((prev) => [reviewData, ...prev]);
      setNewComment('');
      setReviewName('');
    } catch (err) {
      setReviewError('Could not save review right now. Please ensure your account is verified.');
      handleFirestoreError(err, OperationType.CREATE, `reviews/${revId}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!product) return null;

  const productImages =
    product.images && product.images.length > 0 ? product.images : ['/hero-steel.jpg'];
  const safeImageIndex = activeImageIndex < productImages.length ? activeImageIndex : 0;
  const activeImageUrl = productImages[safeImageIndex] || productImages[0] || '/hero-steel.jpg';
  const hasMultipleVariants =
    productImages.length > 1 ||
    (Array.isArray(product.imageColors) && product.imageColors.some((c) => Boolean(c?.trim())));

  const getVariantLabel = (idx: number): string | undefined => {
    const customLabel = product.imageColors?.[idx]?.trim();
    if (customLabel) return customLabel;
    if (productImages.length > 1) return `Color / Style ${idx + 1}`;
    return undefined;
  };
  const selectedVariantLabel = getVariantLabel(safeImageIndex);

  const inWishlist = isInWishlist(product.id);
  const isSale = product.salePrice && product.salePrice < product.price;
  const availableSizes =
    product.sizeOptions && product.sizeOptions.length > 0
      ? product.sizeOptions
      : product.ringSizes || [];
  const customExtraFee =
    product.allowCustomization &&
    customNote.trim().length > 0 &&
    typeof product.customizationFee === 'number' &&
    product.customizationFee > 0
      ? product.customizationFee
      : 0;
  const relatedProducts = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 3);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomPosition({ x, y });
  };

  const handleAddToCart = () => {
    if (product.stock <= 0) return;
    addToCart(
      product,
      quantity,
      selectedSize,
      selectedVariantLabel,
      activeImageUrl,
      customNote.trim() || undefined
    );
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1500);
  };

  const handleBuyNow = () => {
    if (product.stock <= 0) return;
    onInstantBuyNow(
      product,
      quantity,
      selectedSize,
      selectedVariantLabel,
      activeImageUrl,
      customNote.trim() || undefined
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-start sm:items-center justify-center p-2 sm:p-6"
      onClick={onClose}
    >
      
      {/* Modal Container */}
      <div 
        className="relative w-full max-w-5xl bg-[#0c0a07] border border-[#3d311c] rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden my-2 sm:my-6 max-h-[94dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close product details"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 p-2 rounded-full bg-black/85 border border-white/15 text-neutral-200 hover:text-white hover:bg-black transition-all cursor-pointer shadow-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto">
          
          {/* Left Column: Image Gallery & Zoom (Cols 1-6) */}
          <div className="lg:col-span-6 p-4 sm:p-8 bg-[#090806] border-b lg:border-b-0 lg:border-r border-[#241d13] flex flex-col space-y-4">
            
            {/* Main Image with Zoom feature */}
            <div
              onMouseEnter={() => setIsZoomed(true)}
              onMouseLeave={() => setIsZoomed(false)}
              onMouseMove={handleMouseMove}
              className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#0c0a07] border border-[#382b19] ring-1 ring-inset ring-[#D6B16D]/20 shadow-2xl cursor-crosshair group select-none"
            >
              <img
                src={activeImageUrl}
                alt={selectedVariantLabel ? `${product.name} — ${selectedVariantLabel}` : product.name}
                className={`w-full h-full object-cover transition-transform duration-200 ${
                  isZoomed ? 'scale-150' : 'scale-100'
                }`}
                style={
                  isZoomed
                    ? {
                        transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`
                      }
                    : undefined
                }
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.dataset.fallbackApplied) {
                    img.dataset.fallbackApplied = '1';
                    img.src = '/hero-steel.jpg';
                  }
                }}
              />

              {/* Subtle Bottom Edge Blending Scrim Only (No Overlaid Text/Badges on Photo) */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#090806]/35 via-transparent to-transparent pointer-events-none" />

              {/* Gold Corner Filigrees */}
              <div className="absolute top-2.5 left-2.5 w-3.5 h-3.5 border-t-2 border-l-2 border-[#D6B16D] opacity-70 pointer-events-none" />
              <div className="absolute top-2.5 right-2.5 w-3.5 h-3.5 border-t-2 border-r-2 border-[#D6B16D] opacity-70 pointer-events-none" />
              <div className="absolute bottom-2.5 left-2.5 w-3.5 h-3.5 border-b-2 border-l-2 border-[#D6B16D] opacity-70 pointer-events-none" />
              <div className="absolute bottom-2.5 right-2.5 w-3.5 h-3.5 border-b-2 border-r-2 border-[#D6B16D] opacity-70 pointer-events-none" />

              {/* Zoom hint (Desktop only) */}
              <div className="hidden lg:block absolute bottom-3 right-3 px-2 py-1 rounded bg-black/80 backdrop-blur-sm text-[10px] text-neutral-400 pointer-events-none uppercase tracking-wider border border-white/5">
                Hover to Zoom
              </div>
            </div>

            {/* Thumbnails Row */}
            {productImages.length > 1 && (
              <div className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto pb-1 scrollbar-none">
                {productImages.map((img, idx) => {
                  const thumbLabel = getVariantLabel(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      title={thumbLabel || `Angle ${idx + 1}`}
                      className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                        safeImageIndex === idx
                          ? 'border-[#D6B16D] shadow-md shadow-[#D6B16D]/20 scale-105'
                          : 'border-[#292013] opacity-65 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={img}
                        alt={thumbLabel || `Angle ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const el = e.currentTarget;
                          if (!el.dataset.fallbackApplied) {
                            el.dataset.fallbackApplied = '1';
                            el.src = '/hero-steel.jpg';
                          }
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Authenticity Guarantee Callout */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs text-neutral-400">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#110e09] border border-[#231a10]">
                <Sparkles className="w-4 h-4 text-[#D6B16D] shrink-0" />
                <span>100% Quality Guaranteed</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#110e09] border border-[#231a10]">
                <Truck className="w-4 h-4 text-[#D6B16D] shrink-0" />
                <span>Fast Nationwide Courier</span>
              </div>
            </div>

            {/* Complementary Pieces Under Images */}
            {relatedProducts.length > 0 && (
              <div className="pt-4 border-t border-[#241d13] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-[11px] uppercase tracking-widest text-[#D6B16D] font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#D6B16D] shrink-0" />
                    <span>Complementary Pieces</span>
                  </span>
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Related in {product.category}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {relatedProducts.map((rel) => (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => onSelectRelatedProduct(rel)}
                      className="group/rel flex flex-col p-2.5 rounded-xl bg-[#120f0a] border border-[#261e13] hover:border-[#D6B16D] text-left cursor-pointer transition-all shadow-md hover:shadow-black"
                    >
                      <div className="aspect-square w-full rounded-lg overflow-hidden bg-black/50 mb-2 border border-[#2d2215]">
                        <img 
                          src={rel.images[0] || '/hero-steel.jpg'} 
                          alt="" 
                          className="w-full h-full object-cover group-hover/rel:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            const el = e.currentTarget;
                            if (!el.dataset.fallbackApplied) {
                              el.dataset.fallbackApplied = '1';
                              el.src = '/hero-steel.jpg';
                            }
                          }}
                        />
                      </div>
                      <span className="text-xs font-serif font-medium text-white line-clamp-1 group-hover/rel:text-[#D6B16D] transition-colors">
                        {rel.name}
                      </span>
                      <span className="text-xs font-mono text-[#D6B16D] font-semibold mt-0.5">
                        {formatPKR(rel.salePrice ?? rel.price)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Specifications & Actions (Cols 7-12) */}
          <div className="lg:col-span-6 p-4 sm:p-8 flex flex-col justify-between space-y-6">
            
            <div className="space-y-4">
              
              {/* Category, Clean Metadata & SKU */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-[#D6B16D]">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">{product.category}</span>
                  {product.isNewArrival && (
                    <>
                      <span className="text-neutral-600" aria-hidden="true">·</span>
                      <span className="text-[#F4E0A5] font-semibold">New Arrival</span>
                    </>
                  )}
                  {product.material && (
                    <>
                      <span className="text-neutral-600" aria-hidden="true">·</span>
                      <span className="text-neutral-300 font-normal tracking-wider">{product.material}</span>
                    </>
                  )}
                </div>
                <span className="font-mono text-neutral-400">{product.sku}</span>
              </div>

              {/* Title */}
              <h2 className="text-2xl sm:text-3xl font-serif font-medium text-white leading-tight text-balance">
                {product.name}
              </h2>

              {/* Rating */}
              <div className="flex items-center gap-2">
                <div className="flex items-center text-[#D6B16D]">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#D6B16D]" />
                  ))}
                </div>
                <span className="text-xs text-neutral-400">
                  {product.rating || 5.0} ({reviews.length} Verified Reviews)
                </span>
              </div>

              {/* Price in PKR */}
              <div className="pt-2 border-y border-[#241d13] py-3.5 flex flex-wrap items-baseline gap-3">
                {isSale ? (
                  <>
                    <span className="text-2xl sm:text-3xl font-mono tabular-nums font-semibold text-white">
                      {formatPKR(product.salePrice!)}
                    </span>
                    <span className="text-sm font-mono tabular-nums text-neutral-400 line-through">
                      {formatPKR(product.price)}
                    </span>
                    <span className="text-xs font-semibold text-emerald-400">
                      Privilege Savings
                    </span>
                  </>
                ) : (
                  <span className="text-2xl sm:text-3xl font-mono tabular-nums font-semibold text-white">
                    {formatPKR(product.price)}
                  </span>
                )}
                <span className="text-xs text-neutral-400 ml-auto">Inclusive of all duties</span>
              </div>

              {/* Description */}
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-light">
                {product.description}
              </p>

              {/* Color / Design Variant Selector (When multiple images or named colors exist) */}
              {hasMultipleVariants && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-neutral-300 uppercase tracking-wider font-medium">
                      Select Color / Design:
                    </span>
                    {selectedVariantLabel && (
                      <span className="text-[#D6B16D] font-semibold">
                        Selected: {selectedVariantLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {productImages.map((imgUrl, idx) => {
                      const label = getVariantLabel(idx) || `Style ${idx + 1}`;
                      const isSelected = safeImageIndex === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveImageIndex(idx)}
                          className={`flex items-center gap-2 pr-3 pl-1.5 py-1.5 min-h-[40px] rounded-lg text-xs border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#1a140a] text-[#F4E0A5] border-[#D6B16D] font-semibold ring-1 ring-[#D6B16D]/30'
                              : 'bg-[#120e09] text-neutral-300 border-[#2f2416] hover:border-[#D6B16D]/70 hover:text-white'
                          }`}
                        >
                          <img
                            src={imgUrl}
                            alt={label}
                            className="w-7 h-7 rounded object-cover border border-[#3b2e1b] shrink-0"
                            onError={(e) => {
                              const el = e.currentTarget;
                              if (!el.dataset.fallbackApplied) {
                                el.dataset.fallbackApplied = '1';
                                el.src = '/hero-steel.jpg';
                              }
                            }}
                          />
                          <span className="whitespace-nowrap">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Size Selector (Bangles / Rings / Custom Sizes) */}
              {availableSizes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-300 uppercase tracking-wider font-medium">
                      {product.category.toLowerCase().includes('bangle')
                        ? 'Select Bangle Size:'
                        : product.category.toLowerCase().includes('ring')
                        ? 'Select Ring Size:'
                        : 'Select Size:'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSizingGuide((prev) => !prev)}
                      className="text-[#D6B16D] text-[11px] cursor-pointer hover:underline"
                    >
                      {showSizingGuide ? 'Hide Sizing Guide' : 'Sizing Guide'}
                    </button>
                  </div>
                  {showSizingGuide && (
                    <div className="p-3 rounded-lg bg-[#141009] border border-[#2f2416] text-[11px] text-neutral-300 space-y-1.5">
                      <span className="text-[#D6B16D] font-semibold uppercase tracking-wider block text-[10px]">
                        {product.category.toLowerCase().includes('bangle')
                          ? 'Pakistan Standard Bangle Size Chart'
                          : 'US / Pakistan Standard Ring Chart'}
                      </span>
                      {product.category.toLowerCase().includes('bangle') ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[10px] text-neutral-300">
                          <div className="p-1.5 rounded bg-[#0c0906] border border-[#241b0f]">2.2 • Small</div>
                          <div className="p-1.5 rounded bg-[#0c0906] border border-[#241b0f]">2.4 • Medium</div>
                          <div className="p-1.5 rounded bg-[#0c0906] border border-[#241b0f]">2.6 • Large</div>
                          <div className="p-1.5 rounded bg-[#0c0906] border border-[#241b0f]">2.8 • XL</div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-neutral-300">
                          <div className="p-1.5 rounded bg-[#0c0906] border border-[#241b0f]">Size 6 • 16.5 mm</div>
                          <div className="p-1.5 rounded bg-[#0c0906] border border-[#241b0f]">Size 7 • 17.3 mm</div>
                          <div className="p-1.5 rounded bg-[#0c0906] border border-[#241b0f]">Size 8 • 18.1 mm</div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {availableSizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`min-w-[44px] h-10 px-3 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          selectedSize === size
                            ? 'bg-[#D6B16D] text-black border-[#D6B16D] font-bold shadow-md'
                            : 'bg-[#15110a] text-neutral-300 border-[#2f2416] hover:border-[#D6B16D]'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Customer Personalization / Custom Engraving Box */}
              {product.allowCustomization && (
                <div className="p-3.5 rounded-xl bg-[#120e08] border border-[#3a2d18] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#F4E0A5] font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#D6B16D] shrink-0" />
                      <span>{product.customizationLabel || 'Custom Name / Engraving (Optional)'}</span>
                    </span>
                    <span className="text-[11px] font-mono text-[#D6B16D]">
                      {product.customizationFee && product.customizationFee > 0
                        ? `+ ${formatPKR(product.customizationFee)} / pc`
                        : 'Complimentary'}
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={160}
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder={
                      product.customizationPlaceholder ||
                      'Enter custom name, initials, wrist size note, or special request...'
                    }
                    className="w-full bg-[#0a0805] border border-[#2f2416] rounded-lg px-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#D6B16D] resize-none"
                  />
                  <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-400">
                    <span className="truncate">
                      {customExtraFee > 0
                        ? `Personalization fee (${formatPKR(customExtraFee)} × ${quantity}) included in bag total.`
                        : product.customizationNotice || 'Custom orders may take 1 extra day for hand-finishing.'}
                    </span>
                    <span className="font-mono shrink-0">{customNote.length}/160</span>
                  </div>
                  <div className="pt-1 border-t border-[#261d10] flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] text-neutral-400">
                      Design ya picture bhejni ho? Direct WhatsApp karein:
                    </span>
                    <a
                      href={`${(settings.whatsappUrl || 'https://wa.me/923178113817').replace(/\?.*$/, '')}?text=${encodeURIComponent(
                        `Assalam-o-Alaikum ZN Jewelers! Mujhe is item par custom work chahiye:\n• Product: ${product.name} (${product.sku})\n• Price: ${formatPKR((product.salePrice ?? product.price) + customExtraFee)}${selectedVariantLabel ? `\n• Color/Variant: ${selectedVariantLabel}` : ''}${selectedSize ? `\n• Size: ${selectedSize}` : ''}${customNote.trim() ? `\n• Custom Note: "${customNote.trim()}"` : ''}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 hover:bg-emerald-900 hover:text-white text-[11px] font-medium transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Customize via WhatsApp</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Stock Indicator */}
              <div className="flex items-center gap-2 text-xs">
                {product.stock <= 0 ? (
                  <span className="text-red-400 font-medium">Currently Sold Out — Enquire for Bespoke Casting</span>
                ) : (
                  <span className="text-emerald-400 font-medium">
                    In Stock ({product.stock} Hand-Finished Units Available)
                  </span>
                )}
              </div>

              {/* Quantity Selector */}
              {product.stock > 0 && (
                <div className="flex items-center gap-4 pt-2">
                  <span className="text-xs text-neutral-300 uppercase tracking-wider font-medium">Quantity:</span>
                  <div className="flex items-center rounded-lg bg-[#14100a] border border-[#2f2416]">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-3 py-1.5 text-neutral-400 hover:text-white transition-colors"
                    >
                      -
                    </button>
                    <span className="px-4 py-1.5 text-xs font-mono font-medium text-white">{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                      className="px-3 py-1.5 text-neutral-400 hover:text-white transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons: Add to Bag, Buy Now, Wishlist */}
              <div className="flex flex-col sm:flex-row items-stretch gap-3 pt-3">
                <button
                  onClick={handleAddToCart}
                  disabled={product.stock <= 0}
                  className={`flex-1 py-3.5 px-6 rounded-lg font-semibold text-xs uppercase tracking-[0.18em] transition-all flex items-center justify-center gap-2 ${
                    product.stock <= 0
                      ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                      : addedAnimation
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#1a150e] border border-[#3d311c] text-[#D6B16D] hover:bg-[#282114] hover:border-[#D6B16D]'
                  }`}
                >
                  {addedAnimation ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                  <span>{addedAnimation ? 'Added To Bag' : 'Add To Bag'}</span>
                </button>

                <button
                  onClick={handleBuyNow}
                  disabled={product.stock <= 0}
                  className="flex-1 py-3.5 px-6 rounded-lg bg-gradient-to-r from-[#D6B16D] via-[#F4E0A5] to-[#C29B53] text-black font-semibold text-xs uppercase tracking-[0.18em] hover:shadow-[0_0_25px_rgba(214,177,109,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-black" />
                  <span>Instant Buy Now</span>
                </button>

                <button
                  onClick={() => toggleWishlist(product.id)}
                  className="p-3.5 rounded-lg bg-[#14100a] border border-[#2f2416] text-neutral-300 hover:text-[#D6B16D] hover:border-[#D6B16D] transition-all flex items-center justify-center shrink-0"
                  title="Save to Wishlist"
                >
                  <Heart className={`w-5 h-5 ${inWishlist ? 'fill-[#D6B16D] text-[#D6B16D]' : ''}`} />
                </button>
              </div>

            </div>

            {/* Tabs: Specifications, Reviews, Delivery */}
            <div className="border-t border-[#241d13] pt-4 space-y-4">
              <div className="flex items-center gap-4 sm:gap-6 text-xs uppercase tracking-wider border-b border-[#1c160e] pb-2 overflow-x-auto scrollbar-none whitespace-nowrap">
                <button
                  onClick={() => setActiveTab('specs')}
                  className={`pb-1 shrink-0 transition-colors ${
                    activeTab === 'specs' ? 'text-[#D6B16D] border-b-2 border-[#D6B16D] font-semibold' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Specifications
                </button>
                <button
                  onClick={() => setActiveTab('reviews')}
                  className={`pb-1 shrink-0 transition-colors ${
                    activeTab === 'reviews' ? 'text-[#D6B16D] border-b-2 border-[#D6B16D] font-semibold' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Patron Reviews ({reviews.length})
                </button>
                <button
                  onClick={() => setActiveTab('delivery')}
                  className={`pb-1 shrink-0 transition-colors ${
                    activeTab === 'delivery' ? 'text-[#D6B16D] border-b-2 border-[#D6B16D] font-semibold' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  VIP Delivery & Care
                </button>
              </div>

              {/* Tab 1: Specifications */}
              {activeTab === 'specs' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded bg-[#110e09] border border-[#231a10]">
                    <span className="text-neutral-400 block text-[10px] uppercase">Material & Finish</span>
                    <span className="text-white font-medium">{product.material || '18K PVD Anti-Tarnish / Handcrafted'}</span>
                  </div>
                  <div className="p-2.5 rounded bg-[#110e09] border border-[#231a10]">
                    <span className="text-neutral-400 block text-[10px] uppercase">Collection</span>
                    <span className="text-white font-medium">{product.category}</span>
                  </div>
                  <div className="p-2.5 rounded bg-[#110e09] border border-[#231a10] sm:col-span-2">
                    <span className="text-neutral-400 block text-[10px] uppercase">Bespoke Customization / Details</span>
                    <span className="text-white font-medium">
                      {product.customizationNotice || 'Bespoke customization with bride and groom details available.'}
                    </span>
                  </div>
                </div>
              )}

              {/* Tab 2: Reviews */}
              {activeTab === 'reviews' && (
                <div className="space-y-4 max-h-56 overflow-y-auto pr-1">
                  {reviewsLoading ? (
                    <p className="text-xs text-neutral-400">Loading patron reviews...</p>
                  ) : reviews.length === 0 ? (
                    <p className="text-xs text-neutral-400">No patron reviews yet. Sign in below to share your feedback.</p>
                  ) : (
                    reviews.map((rev) => (
                      <div key={rev.id} className="p-3 rounded bg-[#110e09] border border-[#231a10] space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white">{rev.userName}</span>
                          <div className="flex items-center text-[#D6B16D]">
                            {[...Array(rev.rating)].map((_, i) => (
                              <Star key={i} className="w-3 h-3 fill-[#D6B16D]" />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-neutral-300 font-light">{rev.comment}</p>
                      </div>
                    ))
                  )}

                  {/* Add review form */}
                  {!user ? (
                    <div className="space-y-2">
                      <div className="p-3 rounded bg-[#110e09] border border-[#231a10] flex items-center justify-between gap-3 text-xs">
                        <span className="text-neutral-400">Sign in to post a verified patron review.</span>
                        <button
                          type="button"
                          onClick={async () => {
                            clearAuthError();
                            const ok = await loginWithGoogle();
                            if (!ok) {
                              setReviewError('Could not complete Google Sign-In on this domain.');
                            }
                          }}
                          className="px-3 py-1.5 rounded bg-[#D6B16D] text-black font-semibold text-[11px] hover:bg-[#F4E0A5] transition-colors shrink-0"
                        >
                          Sign In
                        </button>
                      </div>
                      {(authError || reviewError) && (
                        <p className="text-[11px] text-rose-400 leading-relaxed">
                          {authError || reviewError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleAddReview} className="space-y-2 pt-2 border-t border-[#231a10]">
                      <span className="text-[11px] uppercase tracking-wider text-[#D6B16D] font-medium block">
                        Write a Patron Review
                      </span>
                      {reviewError && (
                        <p className="text-[11px] text-rose-400">{reviewError}</p>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <input
                          type="text"
                          placeholder="Your Name (Optional)"
                          value={reviewName}
                          onChange={(e) => setReviewName(e.target.value)}
                          className="bg-[#15110a] border border-[#2f2416] text-xs px-3 py-1.5 rounded text-white w-full sm:w-1/2 focus:outline-none focus:border-[#D6B16D]"
                        />
                        <select
                          value={newRating}
                          onChange={(e) => setNewRating(Number(e.target.value))}
                          className="bg-[#15110a] border border-[#2f2416] text-xs px-3 py-1.5 rounded text-white w-full sm:w-auto focus:outline-none focus:border-[#D6B16D]"
                        >
                          <option value={5}>5 Stars - Supreme</option>
                          <option value={4}>4 Stars - Exquisite</option>
                          <option value={3}>3 Stars - Good</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Share your experience with this jewellery piece..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          required
                          className="bg-[#15110a] border border-[#2f2416] text-xs px-3 py-1.5 rounded text-white w-full focus:outline-none focus:border-[#D6B16D]"
                        />
                        <button
                          type="submit"
                          disabled={submittingReview}
                          className="px-3 py-1.5 bg-[#D6B16D] text-black text-xs font-semibold rounded hover:bg-[#F4E0A5] transition-colors shrink-0 disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Tab 3: Delivery */}
              {activeTab === 'delivery' && (
                <div className="space-y-2 text-xs text-neutral-300">
                  <p>• Complimentary armored, insured delivery via TCS/Leopard VIP services across Karachi, Lahore, Islamabad, and nationwide within 48-72 hours.</p>
                  <p>• Delivered in luxury velvet presentation packaging with official ZN JEWELLERS brand authenticity card.</p>
                  <p>• 100% satisfaction guarantee with dedicated customer support across all Pakistan.</p>
                </div>
              )}

            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
