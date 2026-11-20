import React from 'react';
import { Heart, ShoppingBag, Eye, Sparkles, Check } from 'lucide-react';
import { Product } from '../../types';
import { formatPKR } from '../../lib/formatters';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

interface ProductCardProps {
  product: Product;
  onQuickView: (product: Product) => void;
  hideDiscountBadge?: boolean;
  hideNewBadge?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onQuickView,
  hideDiscountBadge = false,
  hideNewBadge = false
}) => {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useAuth();
  const inWishlist = isInWishlist(product.id);
  const [addedAnimation, setAddedAnimation] = React.useState(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.stock <= 0) return;
    const defaultSize = product.ringSizes ? product.ringSizes[0] : undefined;
    const defaultColor =
      product.imageColors?.[0]?.trim() ||
      (product.images && product.images.length > 1 ? 'Color / Style 1' : undefined);
    const defaultImage = product.images?.[0];
    addToCart(product, 1, defaultSize, defaultColor, defaultImage);
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1500);
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  const isSale = product.salePrice && product.salePrice < product.price;
  const discountPercent = isSale 
    ? Math.round(((product.price - product.salePrice!) / product.price) * 100) 
    : 0;

  return (
    <div 
      onClick={() => onQuickView(product)}
      className="group relative bg-[#0e0c08] rounded-xl overflow-hidden border border-[#231d14] hover:border-[#D6B16D]/70 transition-all duration-300 flex flex-col justify-between cursor-pointer shadow-lg hover:shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
    >
      {/* 1. Image Area & Floating Badges */}
      <div className="relative aspect-[4/4.5] w-full overflow-hidden bg-[#14110a]">
        
        {/* Main Product Image */}
        <img
          src={product.images[0] || '/hero-steel.jpg'}
          alt={product.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 brightness-95 group-hover:brightness-100"
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.dataset.fallbackApplied) {
              img.dataset.fallbackApplied = '1';
              img.src = '/hero-steel.jpg';
            }
          }}
        />

        {/* Alternate image on hover if available */}
        {product.images[1] && (
          <img
            src={product.images[1]}
            alt={`${product.name} angle`}
            className="absolute inset-0 w-full h-full object-cover object-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 brightness-95"
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget;
              if (!img.dataset.fallbackApplied) {
                img.dataset.fallbackApplied = '1';
                img.src = '/hero-steel.jpg';
              }
            }}
          />
        )}

        {/* Seamless Luxury Edge Blending: Dark Bottom Fade & Soft Inner Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0c08] via-transparent to-black/25 pointer-events-none" />
        <div className="absolute inset-0 ring-1 ring-inset ring-[#D6B16D]/15 pointer-events-none rounded-t-xl" />

        {/* Top Right Wishlist Button */}
        <button
          onClick={handleWishlistToggle}
          aria-label="Toggle Wishlist"
          className="absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 sm:p-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-neutral-300 hover:text-[#D6B16D] hover:scale-110 transition-all z-10"
        >
          <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${inWishlist ? 'fill-[#D6B16D] text-[#D6B16D]' : ''}`} />
        </button>

        {/* Hover Quick View Trigger Overlay (Desktop Hover Only) */}
        <div className="hidden md:flex absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickView(product);
            }}
            className="w-full py-2 bg-[#17140e]/90 hover:bg-[#D6B16D] text-white hover:text-black text-[11px] font-semibold uppercase tracking-wider rounded border border-[#3b311e] hover:border-[#D6B16D] transition-colors flex items-center justify-center gap-1.5 backdrop-blur-md"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Quick View</span>
          </button>
        </div>

      </div>

      {/* 2. Product Details */}
      <div className="p-3 sm:p-5 flex flex-col justify-between flex-1 space-y-2 sm:space-y-3">
        
        <div>
          <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[11px] text-[#D6B16D]/80 uppercase tracking-wider sm:tracking-widest">
            <span className="truncate">{product.category}</span>
            <span className="hidden sm:inline font-mono text-neutral-400 shrink-0">{product.sku}</span>
          </div>

          <h3 className="text-xs sm:text-base font-serif font-medium text-white group-hover:text-[#D6B16D] transition-colors line-clamp-1 mt-1">
            {product.name}
          </h3>

          {product.images && product.images.length > 1 ? (
            <p className="text-[10px] sm:text-[11px] text-[#D6B16D]/85 line-clamp-1 mt-0.5">
              {product.imageColors && product.imageColors.some((c) => Boolean(c?.trim()))
                ? product.imageColors.filter((c) => Boolean(c?.trim())).join(' · ')
                : `${product.images.length} Styles`}
            </p>
          ) : product.customizationNotice ? (
            <p className="hidden sm:block text-[11px] text-[#D6B16D]/80 line-clamp-1 mt-0.5">
              {product.customizationNotice}
            </p>
          ) : product.material ? (
            <p className="hidden sm:block text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
              {product.material}
            </p>
          ) : null}
        </div>

        {/* Price & Add to Bag */}
        <div className="pt-2 border-t border-[#1d1810] flex items-center justify-between gap-1.5 sm:gap-2">
          
          <div className="flex flex-col min-w-0">
            {isSale ? (
              <div className="flex flex-wrap items-baseline gap-1 sm:gap-2">
                <span className="text-xs sm:text-base font-mono font-semibold text-white">
                  {formatPKR(product.salePrice!)}
                </span>
                <span className="text-[10px] sm:text-[11px] font-mono text-neutral-400 line-through">
                  {formatPKR(product.price)}
                </span>
              </div>
            ) : (
              <span className="text-xs sm:text-base font-mono font-semibold text-white">
                {formatPKR(product.price)}
              </span>
            )}
            <span className="hidden sm:block text-[10px] text-neutral-400">All Taxes Included</span>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={product.stock <= 0}
            className={`p-2 sm:p-2.5 rounded-lg border transition-all duration-200 flex items-center justify-center shrink-0 ${
              product.stock <= 0
                ? 'bg-neutral-900 border-neutral-800 text-neutral-600 cursor-not-allowed'
                : addedAnimation
                ? 'bg-emerald-600 text-white border-emerald-500 scale-95'
                : 'bg-[#18140e] border-[#3b311e] text-[#D6B16D] hover:bg-[#D6B16D] hover:text-black hover:border-[#D6B16D]'
            }`}
            title="Add To Bag"
          >
            {addedAnimation ? (
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : (
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>

        </div>

      </div>

    </div>
  );
};
