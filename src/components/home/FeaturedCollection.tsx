import React, { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useProducts } from '../../context/ProductContext';
import { ProductCard } from '../shop/ProductCard';
import { Product, ProductCategory } from '../../types';

interface FeaturedCollectionProps {
  onQuickView: (product: Product) => void;
  onNavigateShop: (category?: ProductCategory | 'all') => void;
}

export const FeaturedCollection: React.FC<FeaturedCollectionProps> = ({
  onQuickView,
  onNavigateShop
}) => {
  const { products, categories } = useProducts();
  const [activeTab, setActiveTab] = useState<string>('all');

  const getTabLabel = (name: string) => {
    if (name === 'Jewellery Sets') return 'Bridal Sets';
    if (name === 'Stainless Steel Jewellery') return 'Stainless Steel';
    return name;
  };

  const tabCategories = categories.map((c) => c.name);

  const filtered = products.filter((p) => {
    if (activeTab === 'all') return Boolean(p.isFeatured);
    if (
      activeTab === 'Watches' &&
      (p.category === 'Watches' || p.category === "Men's Watches" || p.category === "Women's Watches")
    ) {
      return true;
    }
    return p.category === activeTab;
  }).slice(0, 8);

  return (
    <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-12 bg-[#0a0907] border-t border-[#1d1810]">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-10">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#221c13] pb-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#D6B16D] font-medium">
              <Sparkles className="w-3 h-3" />
              <span>Timeless Craftsmanship</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif text-white tracking-wide">
              Featured <span className="italic font-serif gold-gradient-text">Masterworks</span>
            </h2>
            <p className="hidden md:block text-xs sm:text-sm text-neutral-400 font-light max-w-lg">
              Explore our curated selection of bridal jewellery sets, rings, earrings, luxury chronometers, bangles & kadas, and designer handbags.
            </p>
          </div>

          {/* Dynamic Collection Filter Tabs */}
          <div className="flex md:flex-wrap items-center gap-2 text-xs overflow-x-auto md:overflow-visible pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-full border transition-all text-[11px] uppercase tracking-wider cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-[#D6B16D] text-black border-[#D6B16D] font-semibold'
                  : 'bg-[#14110a] text-neutral-300 border-[#2f2718] hover:border-[#D6B16D]'
              }`}
            >
              All Featured
            </button>
            {tabCategories.map((catName) => (
              <button
                key={catName}
                onClick={() => setActiveTab(catName)}
                className={`px-3.5 py-1.5 rounded-full border transition-all text-[11px] uppercase tracking-wider cursor-pointer shrink-0 whitespace-nowrap ${
                  activeTab === catName
                    ? 'bg-[#D6B16D] text-black border-[#D6B16D] font-semibold'
                    : 'bg-[#14110a] text-neutral-300 border-[#2f2718] hover:border-[#D6B16D]'
                }`}
              >
                {getTabLabel(catName)}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onQuickView={onQuickView}
              hideDiscountBadge={true}
              hideNewBadge={true}
            />
          ))}
        </div>

        {/* View All Call to action */}
        <div className="text-center pt-8">
          <button
            onClick={() => onNavigateShop('all')}
            className="inline-flex items-center gap-3 px-8 py-3.5 bg-[#120f09] border border-[#3b301c] text-[#D6B16D] hover:bg-[#D6B16D] hover:text-black hover:border-[#D6B16D] text-xs uppercase tracking-[0.2em] font-semibold rounded transition-all duration-300"
          >
            <span>View All Curated Collections</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </section>
  );
};
