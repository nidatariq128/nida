import React from 'react';
import { ShieldCheck, HeartHandshake, Sparkles, ShoppingBag, Gem, Award } from 'lucide-react';
import { ProductCategory } from '../../types';

interface BrandStoryProps {
  onSelectCategory?: (category: ProductCategory) => void;
}

export const BrandStory: React.FC<BrandStoryProps> = ({ onSelectCategory }) => {
  const pillars: {
    title: string;
    subtitle: string;
    category: ProductCategory;
    icon: React.ReactNode;
  }[] = [
    {
      title: 'Luxury Watches',
      subtitle: 'Precision chronometers, date dials & mesh watches.',
      category: 'Watches',
      icon: <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[#D6B16D]" />,
    },
    {
      title: 'Bridal Bangles & Kadas',
      subtitle: 'Velvet choodiyan, bridal sets & antique kadas.',
      category: 'Bangles',
      icon: <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-[#D6B16D]" />,
    },
    {
      title: 'Waterproof 316L Steel',
      subtitle: 'Anti-tarnish, non-fading 18K PVD coated pieces.',
      category: 'Stainless Steel Jewellery',
      icon: <HeartHandshake className="w-4 h-4 sm:w-5 sm:h-5 text-[#D6B16D]" />,
    },
    {
      title: 'Designer Handbags',
      subtitle: 'Structured totes, quilted clutches & evening silhouettes.',
      category: 'Handbags',
      icon: <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-[#D6B16D]" />,
    },
    {
      title: 'Bridal Jewellery Sets',
      subtitle: 'Heirloom chokers, haars, rings & jhumka earrings.',
      category: 'Jewellery Sets',
      icon: <Gem className="w-4 h-4 sm:w-5 sm:h-5 text-[#D6B16D]" />,
    },
    {
      title: 'Custom Engraving & Gifts',
      subtitle: 'Personalized notes, box wrapping & gift cards.',
      category: 'Jewellery',
      icon: <Award className="w-4 h-4 sm:w-5 sm:h-5 text-[#D6B16D]" />,
    },
  ];

  return (
    <section className="py-12 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-12 bg-[#0a0907] relative overflow-hidden border-t border-[#1c1811]">
      
      {/* Background Gold Ambient */}
      <div className="absolute top-1/2 right-10 -translate-y-1/2 w-80 h-80 bg-[#D6B16D]/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
        
        {/* Left Editorial Visual (Desktop/Tablet Showcase) */}
        <div className="hidden md:block lg:col-span-5 relative">
          <div className="absolute -inset-2 bg-gradient-to-r from-[#D6B16D]/15 via-transparent to-[#D6B16D]/10 rounded-3xl blur-xl pointer-events-none" />
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-[#3d321d] ring-1 ring-inset ring-[#D6B16D]/20 shadow-2xl bg-[#080808]">
            <img
              src="/hero-sets.jpg"
              alt="Artisanal Bridal & Accessory Craftsmanship at ZN JEWELLERS"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center filter brightness-[0.92] contrast-[1.05] hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/45 to-transparent opacity-95 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,#080808_95%)] opacity-65 pointer-events-none" />

            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[#D6B16D] opacity-70 pointer-events-none" />
            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[#D6B16D] opacity-70 pointer-events-none" />
            
            <div className="absolute bottom-6 left-6 right-6 p-4 rounded-xl bg-[#080808]/90 backdrop-blur-md border border-[#3b311e] space-y-1 shadow-xl">
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#D6B16D] font-medium">Bespoke Dedication</span>
              <p className="text-xs text-neutral-300 italic font-serif">
                "Every ceremonial detail and crafted accessory is an expression of celebration, beauty, and lasting elegance."
              </p>
            </div>
          </div>
        </div>

        {/* Right Story Content (Compact & Crisp on Mobile, Full Editorial on Desktop) */}
        <div className="lg:col-span-7 space-y-6 sm:space-y-8">
          
          <div className="space-y-2.5 sm:space-y-3">
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#D6B16D] font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[#D6B16D]" />
              <span>Why ZN Jewelers</span>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-serif text-white tracking-tight leading-tight">
              The Art of <span className="italic font-serif gold-gradient-text">Cherished Moments</span>.
            </h2>
            <p className="md:hidden text-xs text-neutral-300 font-light leading-relaxed">
              Waterproof 316L steel, bridal bangles, precision watches &amp; luxury handbags delivered nationwide across Pakistan.
            </p>
          </div>

          <div className="hidden md:block space-y-4 text-neutral-300 text-sm sm:text-base font-light leading-relaxed">
            <p>
              At <span className="text-white font-medium">ZN JEWELLERS</span>, we celebrate life's most momentous milestones with exquisite handcrafted artistry and refined luxury.
            </p>
            <p>
              We specialize in heirloom bridal jewellery sets, statement rings, traditional jhumka earrings, luxury watches, Pakistani bridal bangles &amp; kadas, designer handbags, and premium waterproof jewellery designed for effortless everyday elegance.
            </p>
            <p>
              Each piece is selected for lasting durability, comfort, and timeless sophistication, ensuring your celebrations and daily style reflect pure perfection.
            </p>
          </div>

          {/* Clickable Pillars */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 pt-4 border-t border-[#241e14]">
            {pillars.map((pillar) => (
              <button
                key={pillar.title}
                type="button"
                onClick={() => onSelectCategory?.(pillar.category)}
                className="text-left p-3 sm:p-0 rounded-xl sm:rounded-none bg-[#110e0a] sm:bg-transparent border border-[#241c13] sm:border-0 hover:border-[#D6B16D]/50 transition-colors space-y-1.5 group cursor-pointer"
              >
                {pillar.icon}
                <h4 className="text-xs sm:text-sm font-serif font-semibold text-white group-hover:text-[#D6B16D] transition-colors">
                  {pillar.title}
                </h4>
                <p className="text-[11px] sm:text-xs text-neutral-400 leading-snug line-clamp-2">
                  {pillar.subtitle}
                </p>
              </button>
            ))}
          </div>

        </div>

      </div>

    </section>
  );
};

