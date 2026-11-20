import React, { useState, useEffect, useRef } from 'react';
import { Star, Sparkles, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Review } from '../../types';

interface TestimonialCard {
  name: string;
  location: string;
  stars: number;
  title: string;
  comment: string;
}

const CURATED_TESTIMONIALS: TestimonialCard[] = [
  {
    name: 'Amina Al-Mansoor',
    location: 'Karachi, Clifton',
    stars: 5,
    title: 'The Royal Bridal Bangles set was simply breathtaking',
    comment:
      'The 24-piece velvet bangles set with heavy Kundan centerpiece kadas was the talk of my wedding. The antique gold polish and velvet finish felt so luxurious and royal.',
  },
  {
    name: 'Dr. Shahzad Qureshi',
    location: 'Lahore, DHA Phase 5',
    stars: 5,
    title: 'Exquisite chronograph watch and designer handbag',
    comment:
      'Purchased the gold chronograph and the quilted handbag for my anniversary. The finish, anti-tarnish stainless steel construction, and luxury velvet packaging were exceptional.',
  },
  {
    name: 'Fatima Z. Bukhari',
    location: 'Islamabad, F-7/2',
    stars: 5,
    title: 'Bridal Bangles & Waterproof Stainless Steel Jewellery',
    comment:
      'The kundan bangles were magnificent for the wedding, and the everyday stainless steel clover necklace hasn’t tarnished at all even after weeks of continuous wear. 10/10 service!',
  },
];

export const CustomerTestimonials: React.FC = () => {
  const [testimonials, setTestimonials] = useState<TestimonialCard[]>(CURATED_TESTIMONIALS);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(6));
        const snap = await getDocs(q);
        if (!active || snap.empty) return;

        const liveCards: TestimonialCard[] = snap.docs
          .map((d) => d.data() as Review)
          .filter((r) => Boolean(r.comment?.trim()) && Boolean(r.userName?.trim()))
          .map((r) => ({
            name: r.userName,
            location: 'Verified Store Customer',
            stars: Math.max(1, Math.min(5, Math.round(r.rating || 5))),
            title: r.comment.length > 52 ? `${r.comment.slice(0, 52).trim()}...` : r.comment,
            comment: r.comment,
          }));

        if (liveCards.length > 0) {
          const combined = [...liveCards, ...CURATED_TESTIMONIALS].slice(0, Math.max(3, liveCards.length));
          setTestimonials(combined.slice(0, 6));
        }
      } catch {
        // Keep curated fallback silently if offline or unindexed
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isPaused || testimonials.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % testimonials.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isPaused, testimonials.length]);

  const prevReview = () => {
    setActiveSlide((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const nextReview = () => {
    setActiveSlide((prev) => (prev + 1) % testimonials.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsPaused(false);
    if (!touchStartRef.current) return;
    const dx = touchStartRef.current.x - e.changedTouches[0].clientX;
    const dy = touchStartRef.current.y - e.changedTouches[0].clientY;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx > 0) nextReview();
      else prevReview();
    }
    touchStartRef.current = null;
  };

  const safeIndex = activeSlide % testimonials.length;
  const currentReview = testimonials[safeIndex];

  return (
    <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-12 bg-[#060606] border-t border-[#1a160e]">
      <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12">
        
        {/* Header */}
        <div className="text-center space-y-2.5 max-w-xl mx-auto">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#D6B16D] font-medium">
            <Sparkles className="w-3 h-3" />
            <span>Patron Testimonials</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-serif text-white tracking-wide">
            Words From Our <span className="italic font-serif gold-gradient-text">Patrons</span>
          </h2>
          <p className="hidden md:block text-xs sm:text-sm text-neutral-400 font-light">
            Reflections of trust, craftsmanship, and celebration from our valued customers across Pakistan.
          </p>
        </div>

        {/* Mobile Auto-Rotating Single Card Slider */}
        <div
          className="md:hidden space-y-4"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-full p-5 rounded-xl bg-[#0d0c09] border border-[#2b2417] flex flex-col justify-between shadow-xl transition-all duration-300">
            <div className="space-y-3">
              <div className="flex items-center gap-1 text-[#D6B16D]">
                {[...Array(currentReview.stars)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-[#D6B16D]" />
                ))}
              </div>

              <h4 className="text-sm font-serif font-medium text-white leading-snug">
                &ldquo;{currentReview.title}&rdquo;
              </h4>

              <p className="text-xs text-neutral-300 font-light leading-relaxed">
                {currentReview.comment}
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-[#1f1911] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h5 className="text-xs font-semibold text-white tracking-wide truncate">{currentReview.name}</h5>
                <span className="text-[11px] text-neutral-400 block truncate">{currentReview.location}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified Patron</span>
              </div>
            </div>
          </div>

          {/* Mobile Controls & Dots */}
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={prevReview}
              aria-label="Previous review"
              className="p-2 rounded-lg bg-[#120f0a] border border-[#2d2417] text-neutral-300 hover:text-[#D6B16D]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveSlide(idx)}
                  aria-label={`Review ${idx + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === safeIndex ? 'w-6 bg-[#D6B16D]' : 'w-2 bg-[#2d2417]'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={nextReview}
              aria-label="Next review"
              className="p-2 rounded-lg bg-[#120f0a] border border-[#2d2417] text-neutral-300 hover:text-[#D6B16D]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Desktop 3-Column Grid */}
        <div className="hidden md:grid md:grid-cols-3 gap-8">
          {testimonials.slice(0, 3).map((t, index) => (
            <div
              key={index}
              className="p-8 rounded-xl bg-[#0d0c09] border border-[#2b2417] relative flex flex-col justify-between hover:border-[#D6B16D]/60 transition-all duration-300 shadow-xl"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-1 text-[#D6B16D]">
                  {[...Array(t.stars)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#D6B16D]" />
                  ))}
                </div>

                <h4 className="text-base font-serif font-medium text-white leading-snug">
                  &ldquo;{t.title}&rdquo;
                </h4>

                <p className="text-xs text-neutral-300 font-light leading-relaxed">
                  {t.comment}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-[#1f1911] flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-semibold text-white tracking-wide">{t.name}</h5>
                  <span className="text-[11px] text-neutral-400">{t.location}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verified Patron</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

