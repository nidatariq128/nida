import React, { useState } from 'react';
import { 
  Sparkles, 
  Truck, 
  Clock, 
  ShieldCheck, 
  Send, 
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { useAuth } from '../../context/AuthContext';
import { ProductCategory } from '../../types';

// Custom TikTok & Instagram Icons
const InstagramIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

const TikTokIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-2.884 2.87 2.896 2.896 0 0 1-2.884-2.87 2.896 2.896 0 0 1 2.884-2.87c.277 0 .542.04.794.113V9.458a6.31 6.31 0 0 0-.794-.05 6.342 6.342 0 0 0-6.341 6.342 6.342 6.342 0 0 0 6.341 6.342 6.342 6.342 0 0 0 6.342-6.342V8.986a8.212 8.212 0 0 0 4.958 1.637V7.178a4.83 4.83 0 0 1-1.2-.492z"/>
  </svg>
);

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.711 1.456h.005c6.554 0 11.89-5.336 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

interface FooterProps {
  onNavigateView: (view: string) => void;
  onNavigateShop?: (category?: ProductCategory | 'all' | 'new') => void;
  onOpenAdmin: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigateView,
  onNavigateShop,
  onOpenAdmin
}) => {
  const { settings } = useStoreSettings();
  const { user, isAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'subscribers'), {
        email: email.trim().toLowerCase(),
        subscribedAt: new Date().toISOString()
      });
      setSubscribed(true);
      setEmail('');
    } catch (err) {
      console.warn('Subscribed locally:', err);
      setSubscribed(true);
      setEmail('');
    } finally {
      setSubmitting(false);
    }
  };

  const quickCollections: { label: string; category: ProductCategory | 'all' | 'new' }[] = [
    { label: 'New Arrivals', category: 'new' },
    { label: 'Jewellery Sets', category: 'Jewellery Sets' },
    { label: 'Bridal Bangles & Kadas', category: 'Bangles' },
    { label: 'Luxury Watches', category: 'Watches' },
    { label: 'Waterproof 316L Steel', category: 'Stainless Steel Jewellery' },
    { label: 'Designer Handbags', category: 'Handbags' },
    { label: 'Rings & Earrings', category: 'Rings' },
  ];

  return (
    <footer className="bg-[#050505] text-neutral-300 border-t border-[#1e1911]">
      
      {/* 1. Compact Store Guarantees */}
      <div className="border-b border-[#1c1710] py-7 sm:py-9 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl bg-[#0a0a0a] border border-[#231d13]">
            <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-[#D6B16D] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs sm:text-sm font-serif font-semibold text-white">
                Free Delivery ₨ {settings.freeShippingThreshold.toLocaleString()}+
              </h4>
              <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5">
                Cash on Delivery across Pakistan.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl bg-[#0a0a0a] border border-[#231d13]">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-[#D6B16D] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs sm:text-sm font-serif font-semibold text-white">
                Anti-Tarnish 316L Steel
              </h4>
              <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5">
                100% waterproof daily-wear finishes.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl bg-[#0a0a0a] border border-[#231d13]">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-[#D6B16D] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs sm:text-sm font-serif font-semibold text-white">
                Custom Gift Packaging
              </h4>
              <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5">
                Velvet boxes, bridal hampers &amp; notes.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl bg-[#0a0a0a] border border-[#231d13]">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-[#D6B16D] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs sm:text-sm font-serif font-semibold text-white">
                7-Day Easy Exchange
              </h4>
              <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5">
                Dedicated WhatsApp concierge support.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 4 Functional Navigation Columns */}
      <div className="py-12 sm:py-16 px-6 lg:px-12 max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
        
        {/* Column 1: Shop Collections (Clickable!) */}
        <div className="space-y-4">
          <h4 className="text-xs uppercase tracking-[0.2em] text-[#D6B16D] font-bold">
            Shop Collections
          </h4>
          <ul className="space-y-2.5 text-xs text-neutral-400">
            {quickCollections.map((item) => (
              <li key={item.label}>
                <button
                  onClick={() => onNavigateShop ? onNavigateShop(item.category) : onNavigateView('shop')}
                  className="hover:text-[#D6B16D] transition-colors text-left"
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 2: Customer Support */}
        <div className="space-y-4">
          <h4 className="text-xs uppercase tracking-[0.2em] text-[#D6B16D] font-bold">
            Customer Support
          </h4>
          <ul className="space-y-2.5 text-xs text-neutral-400">
            <li>
              <button onClick={() => onNavigateView('tracking')} className="hover:text-[#D6B16D] transition-colors text-left">
                Track Your Order
              </button>
            </li>
            <li>
              <button onClick={() => onNavigateView('contact')} className="hover:text-[#D6B16D] transition-colors text-left">
                Contact Us &amp; Store Help
              </button>
            </li>
            <li>
              <button onClick={() => onNavigateView('faqs')} className="hover:text-[#D6B16D] transition-colors text-left">
                Frequently Asked Questions
              </button>
            </li>
            <li>
              <button onClick={() => onNavigateView('product-care')} className="hover:text-[#D6B16D] transition-colors text-left">
                Product Care Guide
              </button>
            </li>
            <li>
              <button onClick={() => onNavigateView('shipping-delivery')} className="hover:text-[#D6B16D] transition-colors text-left">
                Shipping &amp; Delivery Policy
              </button>
            </li>
            <li>
              <button onClick={() => onNavigateView('returns-refunds')} className="hover:text-[#D6B16D] transition-colors text-left">
                Returns, Refunds &amp; Exchange
              </button>
            </li>
            <li>
              <button onClick={() => onNavigateView('warranty-policy')} className="hover:text-[#D6B16D] transition-colors text-left">
                Warranty Policy
              </button>
            </li>
            {user && isAdmin && (
              <li className="pt-2">
                <button 
                  onClick={onOpenAdmin} 
                  className="text-[#D6B16D]/80 hover:text-[#D6B16D] transition-colors text-left flex items-center gap-1.5 text-[11px] font-mono"
                >
                  <Sparkles className="w-3 h-3 text-[#D6B16D]" />
                  <span>Admin Dashboard</span>
                </button>
              </li>
            )}
          </ul>
        </div>

        {/* Column 3: Our Store Location */}
        <div className="space-y-4">
          <h4 className="text-xs uppercase tracking-[0.2em] text-[#D6B16D] font-bold">
            Our Store Location
          </h4>
          <div className="space-y-3 text-xs text-neutral-300">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-[#D6B16D] shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-medium">{settings.businessName} Flagship:</strong>
                <span className="text-neutral-400 leading-relaxed block mt-0.5">{settings.storeAddress}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-[#D6B16D] shrink-0" />
              <a href={`tel:${settings.phone.replace(/[^0-9+]/g, '')}`} className="text-neutral-300 hover:text-[#D6B16D] transition-colors">
                {settings.phone}
              </a>
            </div>

            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-[#D6B16D] shrink-0" />
              <a href={`mailto:${settings.email}`} className="text-neutral-300 hover:text-[#D6B16D] transition-colors break-all">
                {settings.email}
              </a>
            </div>

            <div className="pt-1">
              <span className="text-[11px] text-neutral-500 block mb-2">
                Mon – Sat • 12:00 PM – 10:00 PM PKT
              </span>
              <a
                href={settings.googleMapsSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#D6B16D] hover:underline font-medium"
              >
                <span>Directions on Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Column 4: Connect & VIP Newsletter (Slim & Clean — No Duplicate Social Cards) */}
        <div className="space-y-4">
          <h4 className="text-xs uppercase tracking-[0.2em] text-[#D6B16D] font-bold">
            Connect &amp; VIP Updates
          </h4>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Get alerts on new bridal sets, waterproof steel drops, and festive offers.
          </p>

          {/* Compact Social Icon Links */}
          <div className="flex items-center gap-2.5">
            <a
              href={settings.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              title="Follow on Instagram"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#252018] hover:border-[#D6B16D] text-xs text-neutral-200 hover:text-[#D6B16D] transition-colors"
            >
              <InstagramIcon className="w-3.5 h-3.5 text-[#fd1d1d]" />
              <span>Instagram</span>
            </a>

            <a
              href={settings.tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              title="Watch on TikTok"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#252018] hover:border-[#D6B16D] text-xs text-neutral-200 hover:text-[#D6B16D] transition-colors"
            >
              <TikTokIcon className="w-3.5 h-3.5 text-[#00f2fe]" />
              <span>TikTok</span>
            </a>

            <a
              href={settings.whatsappCommunityUrl || settings.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              title="Chat on WhatsApp"
              className="flex items-center justify-center p-2 rounded-lg bg-[#0f0f0f] border border-[#252018] hover:border-emerald-500 text-emerald-400 transition-colors"
            >
              <WhatsAppIcon className="w-4 h-4" />
            </a>
          </div>

          {/* VIP Newsletter */}
          <div className="pt-1">
            {subscribed ? (
              <div className="flex items-center gap-2 text-xs text-[#D6B16D] bg-[#1a160f] p-2.5 rounded-lg border border-[#3b311e]">
                <CheckCircle className="w-3.5 h-3.5 text-[#D6B16D]" />
                <span>Enrolled in VIP updates.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-1.5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email for VIP drops..."
                  required
                  className="bg-[#12100c] border border-[#3b311e] text-neutral-200 text-xs px-3 py-2 rounded focus:outline-none focus:border-[#D6B16D] w-full placeholder:text-neutral-600"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  aria-label="Subscribe"
                  className="px-3 py-2 bg-[#D6B16D] text-black text-xs font-bold rounded hover:bg-[#F4E0A5] transition-colors shrink-0"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>
            )}
          </div>

          <button
            onClick={() => onNavigateView('about')}
            className="text-xs text-neutral-400 hover:text-[#D6B16D] transition-colors inline-block pt-1"
          >
            Read About ZN Jewelers →
          </button>
        </div>

      </div>

      {/* 3. Bottom Legal & Copyright Bar */}
      <div className="border-t border-[#1a150e] py-6 px-6 lg:px-12 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 ZN Jewelers. All Rights Reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] tracking-wider uppercase">
            <button onClick={() => onNavigateView('privacy-policy')} className="hover:text-neutral-300 transition-colors">
              Privacy Policy
            </button>
            <span>•</span>
            <button onClick={() => onNavigateView('terms-conditions')} className="hover:text-neutral-300 transition-colors">
              Terms &amp; Conditions
            </button>
            <span>•</span>
            <button onClick={() => onNavigateView('product-quality')} className="hover:text-neutral-300 transition-colors">
              Quality &amp; Authenticity
            </button>
            <span>•</span>
            <button onClick={() => onNavigateView('shipping-delivery')} className="hover:text-neutral-300 transition-colors">
              Shipping Policy
            </button>
            <span>•</span>
            <button onClick={() => onNavigateView('contact')} className="hover:text-neutral-300 transition-colors">
              Karachi Store
            </button>
          </div>
        </div>
      </div>

    </footer>
  );
};
