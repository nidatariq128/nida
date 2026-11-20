import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useStoreSettings } from '../../context/StoreSettingsContext';

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

interface SocialPost {
  id: string;
  type: 'instagram' | 'tiktok' | 'whatsapp';
  image: string;
  caption: string;
  actionLabel: string;
}

const SOCIAL_POSTS: SocialPost[] = [
  {
    id: 'sp-1',
    type: 'instagram',
    image: '/hero-earrings.jpg',
    caption: 'Daily styling reels, bridal earrings, waterproof pieces & close-ups on our official Instagram.',
    actionLabel: 'Follow on Instagram'
  },
  {
    id: 'sp-2',
    type: 'tiktok',
    image: '/hero-rings.jpg',
    caption: 'Live unboxings, gift hamper packing, custom orders & restock clips on our official TikTok.',
    actionLabel: 'Watch on TikTok'
  },
  {
    id: 'sp-3',
    type: 'whatsapp',
    image: '/hero-collection-enhanced.jpg',
    caption: 'Direct WhatsApp Concierge for fresh arrivals, custom sizing & instant order booking.',
    actionLabel: 'Join WhatsApp'
  }
];

export const SocialShowcase: React.FC = () => {
  const { settings } = useStoreSettings();
  const whatsappCommunityLink = settings.whatsappCommunityUrl || settings.whatsappUrl;

  const getPostHref = (type: SocialPost['type']) => {
    if (type === 'instagram') return settings.instagramUrl;
    if (type === 'tiktok') return settings.tiktokUrl;
    return whatsappCommunityLink;
  };

  const getChannelLabel = (type: SocialPost['type']) => {
    if (type === 'whatsapp') return 'ZN VIP Community';
    const rawUrl = type === 'instagram' ? settings.instagramUrl : settings.tiktokUrl;
    const clean = rawUrl?.split('?')[0].replace(/\/+$/, '').split('/').pop() || '';
    if (clean.toLowerCase().includes('zn')) {
      return clean.startsWith('@') ? clean : `@${clean}`;
    }
    return type === 'instagram' ? 'ZN Jewelers Official' : 'ZN Jewelers Official';
  };

  return (
    <section className="py-14 sm:py-20 bg-[#0a0a0a] border-t border-[#1a1a1a] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-12 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#D6B16D] font-medium mb-2">
              <InstagramIcon className="w-3.5 h-3.5" />
              <span>Community &amp; Style</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-serif font-bold text-white tracking-tight">
              Follow Us on Social Media
            </h2>
            <p className="hidden md:block text-neutral-400 text-sm mt-2 max-w-xl">
              Follow ZN Jewelers on Instagram &amp; TikTok or message our WhatsApp Concierge for daily styling videos and fresh drops.
            </p>
          </div>
        </div>

        {/* 3-Channel Grid: Instagram, TikTok, WhatsApp Community */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
          {SOCIAL_POSTS.map((post) => (
            <a
              key={post.id}
              href={getPostHref(post.type)}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative rounded-2xl overflow-hidden bg-[#141414] border border-[#222] hover:border-[#D6B16D]/60 transition-all duration-300 flex flex-col cursor-pointer"
            >
              {/* Media Container */}
              <div className="relative aspect-[4/3] sm:aspect-square w-full overflow-hidden bg-black">
                <img
                  src={post.image}
                  alt={post.caption}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-75 group-hover:opacity-90 transition-opacity" />

                {/* Channel Label Top Left */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/75 backdrop-blur-md border border-white/10 text-white text-[11px] font-medium">
                  {post.type === 'instagram' ? (
                    <>
                      <InstagramIcon className="w-3 h-3 text-[#fd1d1d]" />
                      <span>Instagram</span>
                    </>
                  ) : post.type === 'tiktok' ? (
                    <>
                      <TikTokIcon className="w-3 h-3 text-[#00f2fe]" />
                      <span>TikTok</span>
                    </>
                  ) : (
                    <>
                      <WhatsAppIcon className="w-3 h-3 text-[#25D366]" />
                      <span>WhatsApp</span>
                    </>
                  )}
                </div>

                {/* Hover Action Label */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="flex items-center gap-2 text-white text-xs font-semibold uppercase tracking-wider bg-black/80 backdrop-blur-md px-4 py-2 rounded-lg border border-[#D6B16D]/50">
                    <span>{post.actionLabel}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#D6B16D]" />
                  </span>
                </div>
              </div>

              {/* Caption & Profile Link */}
              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed">
                  {post.caption}
                </p>
                <div className="pt-2.5 border-t border-[#1f1f1f] flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">
                    {getChannelLabel(post.type)}
                  </span>
                  <span className="text-[#D6B16D] group-hover:underline flex items-center gap-1 font-medium whitespace-nowrap">
                    {post.type === 'whatsapp' ? 'Join Now' : 'View Profile'} <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Store Walk-in Notice */}
        <div className="mt-8 sm:mt-10 text-center text-xs text-neutral-500">
          Visit our Karachi flagship at <strong className="text-neutral-300">{settings.storeAddress}</strong>
        </div>

      </div>
    </section>
  );
};


