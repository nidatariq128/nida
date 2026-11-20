import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Sparkles,
  ArrowRight,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ProductCategory } from '../../types';
import { useProducts } from '../../context/ProductContext';
import { formatPKR } from '../../lib/formatters';

interface HeroProps {
  onShopCollection: () => void;
  onExploreMore: () => void;
  onSelectCategory: (category: ProductCategory) => void;
  onQuickViewHeroProduct: () => void;
}

interface HeroSlide {
  id: string;
  productId: string;
  productName: string;
  category: ProductCategory;
  tag: string;
  headline: string;
  highlightWord: string;
  description: string;
  price: string;
  image: string;
  accentColor: string;
}

const getCategoryTagline = (cat: ProductCategory): string => {
  if (cat === 'Watches' || cat === "Men's Watches" || cat === "Women's Watches") {
    return 'Precision Horlogerie';
  }
  if (cat === 'Handbags') {
    return 'Haute Designer Leathercraft';
  }
  if (cat === 'Bangles' || cat === 'Jewellery Sets' || cat === 'Earrings') {
    return 'Bespoke Bridal Masterwork';
  }
  return '100% Waterproof & Anti-Tarnish';
};

const DEFAULT_SLIDES: HeroSlide[] = [
  {
    id: 'slide-bangles',
    productId: 'zn-prod-005',
    productName: 'Royal Kundan & Velvet Bridal Choodiyan',
    category: 'Bangles',
    tag: 'Bespoke Bridal Masterwork',
    headline: 'Royal Kundan & Velvet',
    highlightWord: 'Bridal Bangles',
    description:
      '24-piece Pakistani bridal choodiyan set handcrafted in rich ruby velvet, antique gold-polished filigree separators, and grand Kundan centerpiece kadas.',
    price: '₨ 5,800',
    image: '/hero-bangles.jpg',
    accentColor: '#D6B16D',
  },
  {
    id: 'slide-watches',
    productId: 'zn-prod-013',
    productName: 'The Sovereign Chronograph Watch',
    category: 'Watches',
    tag: 'Precision Horlogerie',
    headline: 'The Sovereign Chronograph',
    highlightWord: 'Luxury Watches',
    description:
      'Prestigious black & gold men’s chronometer timepiece featuring functional sub-dials, tachymeter bezel, 3ATM water resistance, and an 18K ion gold-plated oyster bracelet.',
    price: '₨ 8,500',
    image: '/hero-watches.jpg',
    accentColor: '#E6C687',
  },
  {
    id: 'slide-sets',
    productId: 'zn-prod-021',
    productName: 'Royal Kundan & Pearl Bridal Choker Set',
    category: 'Jewellery Sets',
    tag: 'Bespoke Bridal Masterwork',
    headline: 'Royal Kundan & Pearl',
    highlightWord: 'Bridal Set',
    description:
      'Heirloom bridal choker necklace with matching chandelier earrings, handcrafted in antique gold polish with uncut Kundan polki glass stones.',
    price: '₨ 8,800',
    image: '/hero-sets.jpg',
    accentColor: '#D6B16D',
  },
  {
    id: 'slide-steel',
    productId: 'zn-prod-017',
    productName: '18K PVD Waterproof Steel Collection',
    category: 'Stainless Steel Jewellery',
    tag: '100% Waterproof & Anti-Tarnish',
    headline: '18K PVD Coated',
    highlightWord: 'Modern Steel',
    description:
      'Guaranteed non-fading everyday luxury. Surgical grade 316L stainless steel herringbone chains, Roman numeral bangles, and lucky clover pendants resistant to perfume & water.',
    price: '₨ 3,200',
    image: '/hero-steel.jpg',
    accentColor: '#D6B16D',
  },
  {
    id: 'slide-rings',
    productId: 'zn-prod-023',
    productName: '18K PVD French Croissant & Solitaire Rings',
    category: 'Rings',
    tag: '100% Waterproof & Anti-Tarnish',
    headline: '18K PVD Coated',
    highlightWord: 'Statement Rings',
    description:
      'Chunky French croissant dome rings and crystal solitaire bands crafted in hypoallergenic 316L titanium steel that never turn your skin green.',
    price: '₨ 2,100',
    image: '/hero-rings.jpg',
    accentColor: '#D6B16D',
  },
  {
    id: 'slide-earrings',
    productId: 'zn-prod-025',
    productName: 'Royal Kundan Chandbali Earrings',
    category: 'Earrings',
    tag: 'Bespoke Bridal Masterwork',
    headline: 'Royal Kundan Chandbali',
    highlightWord: 'Bridal Earrings',
    description:
      'Grand crescent moon chandeliers with faceted Kundan settings and dense freshwater seed pearl bunch hangings.',
    price: '₨ 3,400',
    image: '/hero-earrings.jpg',
    accentColor: '#E6C687',
  },
  {
    id: 'slide-handbags',
    productId: 'zn-prod-009',
    productName: 'The Aurelia Structured Handbag',
    category: 'Handbags',
    tag: 'Haute Designer Leathercraft',
    headline: 'The Aurelia Structured',
    highlightWord: 'Luxury Handbags',
    description:
      'Iconic structured silhouette in premium micro-grain vegan leather with 18K champagne gold turn-lock hardware, protective studs, and detachable crossbody strap.',
    price: '₨ 7,800',
    image: '/hero-handbags.jpg',
    accentColor: '#E6C687',
  },
];

const resolveCategoryHeroFallbackImage = (catName: string): string => {
  if (catName === 'Jewellery Sets') return '/hero-sets.jpg';
  if (catName === 'Rings') return '/hero-rings.jpg';
  if (catName === 'Earrings') return '/hero-earrings.jpg';
  if (catName === 'Bangles') return '/hero-bangles.jpg';
  if (catName === 'Jewellery') return '/hero-collection-enhanced.jpg';
  if (catName === 'Watches' || catName === "Men's Watches" || catName === "Women's Watches") {
    return '/hero-watches.jpg';
  }
  if (catName === 'Handbags') return '/hero-handbags.jpg';
  return '/hero-steel.jpg';
};

export const Hero: React.FC<HeroProps> = ({
  onShopCollection,
  onSelectCategory,
}) => {
  const { setSelectedProductForModal, products, categories } = useProducts();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const SLIDE_DURATION = 4800;

  const slides: HeroSlide[] = useMemo(() => {
    if (!categories || categories.length === 0) {
      return DEFAULT_SLIDES;
    }

    const usedImages = new Set<string>();
    const pickUniqueImage = (candidates: (string | undefined)[]): string => {
      for (const raw of candidates) {
        const clean = (raw || '').trim();
        if (clean && !usedImages.has(clean)) {
          usedImages.add(clean);
          return clean;
        }
      }
      return '';
    };

    const mapped: HeroSlide[] = [];
    const seenCategories = new Set<string>();

    for (const cat of categories) {
      const catName = cat?.name?.trim();
      if (!catName || seenCategories.has(catName)) continue;
      seenCategories.add(catName);

      // Always prioritize the Collection's own display image in Hero
      const uniqueImg = pickUniqueImage([
        cat.image,
        resolveCategoryHeroFallbackImage(catName),
        '/hero-collection.jpg',
      ]);
      if (!uniqueImg) continue;

      const catProducts = products.filter((p) => p.category === catName);
      const featuredProd = [...catProducts].sort((a, b) => {
        const scoreA = (a.stock > 0 ? 4 : 0) + (a.isFeatured ? 2 : 0) + ((a.rating || 0) >= 4.9 ? 1 : 0);
        const scoreB = (b.stock > 0 ? 4 : 0) + (b.isFeatured ? 2 : 0) + ((b.rating || 0) >= 4.9 ? 1 : 0);
        return scoreB - scoreA;
      })[0];

      mapped.push({
        id: `cat-slide-${catName}`,
        productId: featuredProd?.id || '',
        productName: cat.tagline || catName,
        category: catName as ProductCategory,
        tag: cat.tagline || getCategoryTagline(catName as ProductCategory),
        headline: cat.tagline || 'Curated Luxury',
        highlightWord: catName,
        description: cat.description || `Explore our handcrafted ${catName} collection.`,
        price: featuredProd ? formatPKR(featuredProd.salePrice || featuredProd.price) : 'View Collection',
        image: uniqueImg,
        accentColor: '#D6B16D',
      });
    }

    return mapped.length > 0 ? mapped : DEFAULT_SLIDES;
  }, [products, categories]);

  const safeSlideIndex = currentSlideIndex < slides.length ? currentSlideIndex : 0;
  const currentSlide = slides[safeSlideIndex] || slides[0] || DEFAULT_SLIDES[0];

  const nextSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const goToSlide = (idx: number) => {
    setCurrentSlideIndex(idx);
  };

  useEffect(() => {
    if (isPaused) return;
    progressIntervalRef.current = setInterval(() => {
      nextSlide();
    }, SLIDE_DURATION);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [nextSlide, isPaused]);

  // Touch Swipe Handlers — only triggers on intentional horizontal swipe (prevents accidental skips during vertical scroll)
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsPaused(false);
    if (!touchStartRef.current) return;
    const dx = touchStartRef.current.x - e.changedTouches[0].clientX;
    const dy = touchStartRef.current.y - e.changedTouches[0].clientY;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
    touchStartRef.current = null;
  };

  const handleQuickViewCurrent = () => {
    const found = products.find((p) => p.id === currentSlide.productId);
    if (found) {
      setSelectedProductForModal(found);
    } else {
      onSelectCategory(currentSlide.category);
    }
  };

  return (
    <section
      className="relative w-full lg:min-h-[86vh] flex items-center overflow-hidden bg-[#080808] border-b border-[#221c13]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Ambient Lighting */}
      <div className="hidden sm:block absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] bg-[#D6B16D]/10 rounded-full blur-[150px] pointer-events-none transition-all duration-1000" />
      <div className="hidden sm:block absolute bottom-10 right-1/4 w-[32rem] h-[32rem] bg-[#A67C2E]/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Main Hero Container */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-12 py-5 sm:py-9 lg:py-14 flex flex-col lg:grid lg:grid-cols-12 gap-5 lg:gap-12 items-center z-10">
        {/* Left Column on Desktop (Order 1 & 3 on Mobile) */}
        <div className="contents lg:block lg:col-span-7 lg:space-y-7">
          {/* Header Copy */}
          <div className="order-1 w-full space-y-2.5 sm:space-y-4">
            <div className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] uppercase tracking-[0.22em] sm:tracking-[0.26em] text-[#D6B16D] font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#D6B16D] shrink-0" />
              <span>{currentSlide.tag}</span>
            </div>

            <div className="lg:min-h-[116px] flex flex-col justify-center">
              <h1 className="text-[26px] sm:text-4xl lg:text-5xl xl:text-6xl font-serif text-white font-normal tracking-tight leading-[1.16] text-balance">
                {currentSlide.headline},{' '}
                <span className="gold-gradient-text italic font-serif inline-block">
                  {currentSlide.highlightWord}
                </span>
              </h1>
            </div>

            <p className="text-xs sm:text-sm md:text-base text-neutral-300 font-light leading-relaxed max-w-xl line-clamp-2 md:line-clamp-none">
              {currentSlide.description}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="order-3 w-full grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3.5 pt-0.5">
            <button
              type="button"
              onClick={onShopCollection}
              className="w-full sm:w-auto min-h-[44px] px-5 sm:px-7 py-3 bg-gradient-to-r from-[#D6B16D] via-[#F4E0A5] to-[#C29B53] text-black text-xs uppercase tracking-[0.18em] font-semibold rounded-lg hover:shadow-[0_0_30px_rgba(214,177,109,0.4)] transition-all duration-300 flex items-center justify-center gap-2 group cursor-pointer shadow-lg shadow-black/80"
            >
              <span>Explore All Collections</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform shrink-0" />
            </button>

            <div className="grid grid-cols-2 sm:flex items-center gap-2.5 sm:gap-3.5">
              <button
                type="button"
                onClick={() => onSelectCategory(currentSlide.category)}
                className="min-h-[44px] px-4 sm:px-6 py-3 bg-[#120f0a] border border-[#3d321d] text-neutral-200 text-[11px] sm:text-xs uppercase tracking-[0.14em] sm:tracking-[0.18em] font-medium rounded-lg hover:border-[#D6B16D] hover:text-[#D6B16D] hover:bg-[#18140c] transition-all duration-300 flex items-center justify-center text-center cursor-pointer truncate"
              >
                <span className="truncate">Shop {currentSlide.category === 'Stainless Steel Jewellery' ? 'Steel' : currentSlide.category}</span>
              </button>

              <button
                type="button"
                onClick={handleQuickViewCurrent}
                className="min-h-[44px] px-4 py-3 rounded-lg bg-[#141009]/90 border border-[#2b2114] text-neutral-200 hover:text-[#D6B16D] hover:border-[#D6B16D] text-[11px] sm:text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Quick view this product"
              >
                <Eye className="w-4 h-4 shrink-0" />
                <span>Quick View</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column on Desktop (Order 2 on Mobile) — Clean Unobstructed Showcase Image */}
        <div
          className="order-2 lg:order-none lg:col-span-5 w-full relative flex flex-col items-center justify-center"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="hidden sm:block absolute w-80 h-80 bg-[#D6B16D]/15 rounded-full blur-[120px] pointer-events-none" />

          {/* Clean Showcase Image Frame (Zero Overlaid Text/Badges on Photo) */}
          <div
            onClick={handleQuickViewCurrent}
            className="relative w-full max-w-sm sm:max-w-md lg:max-w-lg aspect-[4/3.6] sm:aspect-[4/4] lg:aspect-[4/4.2] rounded-2xl overflow-hidden border border-[#3d301b] ring-1 ring-inset ring-[#D6B16D]/20 bg-[#080808] shadow-[0_24px_70px_rgba(0,0,0,0.9)] group select-none cursor-pointer"
            title="Tap to view product details"
          >
            {slides.map((slide, idx) => {
              const isActive = idx === safeSlideIndex;
              return (
                <div
                  key={slide.id}
                  className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                    isActive
                      ? 'opacity-100 scale-100 z-10'
                      : 'opacity-0 scale-105 pointer-events-none z-0'
                  }`}
                >
                  <img
                    src={slide.image}
                    alt={`${slide.headline} - ZN JEWELLERS`}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (!img.dataset.fallbackApplied) {
                        img.dataset.fallbackApplied = '1';
                        img.src = '/hero-steel.jpg';
                      }
                    }}
                    className="w-full h-full object-cover object-center transition-transform duration-1000 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080808]/60 via-transparent to-transparent pointer-events-none" />
                </div>
              );
            })}

            {/* Atelier Gold Corner Accents */}
            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[#D6B16D] z-20 pointer-events-none opacity-75" />
            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[#D6B16D] z-20 pointer-events-none opacity-75" />
            <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-[#D6B16D] z-20 pointer-events-none opacity-75" />
            <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-[#D6B16D] z-20 pointer-events-none opacity-75" />
          </div>

          {/* Slide Controls & Dots Below Frame */}
          <div className="flex items-center justify-between w-full max-w-sm sm:max-w-md lg:max-w-lg mt-3 px-1 z-20">
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous slide"
              className="p-2 rounded-lg bg-[#120f0a] border border-[#2d2417] text-neutral-300 hover:text-[#D6B16D] hover:border-[#D6B16D] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => goToSlide(idx)}
                  aria-label={`Jump to slide ${idx + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    idx === safeSlideIndex
                      ? 'w-7 bg-[#D6B16D]'
                      : 'w-2 bg-[#2d2417] hover:bg-[#524128]'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next slide"
              className="p-2 rounded-lg bg-[#120f0a] border border-[#2d2417] text-neutral-300 hover:text-[#D6B16D] hover:border-[#D6B16D] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
