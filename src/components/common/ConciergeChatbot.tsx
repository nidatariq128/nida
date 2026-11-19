import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  ExternalLink,
  Truck,
  MapPin,
  ShoppingBag,
  Loader2,
} from 'lucide-react';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { useProducts } from '../../context/ProductContext';
import { formatPKR } from '../../lib/formatters';
import { Product } from '../../types';

interface SuggestedProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  stock: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  suggestedProducts?: SuggestedProduct[];
}

interface ConciergeChatbotProps {
  onSelectProduct: (product: Product) => void;
  onNavigateTracking: () => void;
  hidden?: boolean;
}

export const ConciergeChatbot: React.FC<ConciergeChatbotProps> = ({
  onSelectProduct,
  onNavigateTracking,
  hidden = false,
}) => {
  const { settings } = useStoreSettings();
  const { getProductById } = useProducts();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'model',
      text: 'Assalam-o-Alaikum! Welcome to ZN Jewelers Concierge. Ask about Watches, Bridal Bangles, 316L Waterproof Steel Jewellery, Delivery Charges, or Order Tracking — or tap WhatsApp anytime.',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (hidden) return null;

  const whatsappDigits = (settings.whatsappNumber || '+923178113817').replace(/[^0-9]/g, '') || '923178113817';
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.text;
  const whatsappHref = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
    lastUserMessage
      ? `Assalam-o-Alaikum ZN Jewelers! I need assistance regarding: "${lastUserMessage}"`
      : 'Assalam-o-Alaikum ZN Jewelers! I would like to inquire about your collection.'
  )}`;

  const sendMessage = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    try {
      const historyPayload = nextMessages
        .filter((m) => m.id !== 'welcome-msg')
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload.slice(0, -1),
        }),
      });

      const data = await res.json();
      const replyText =
        res.ok && typeof data?.reply === 'string' && data.reply.trim()
          ? data.reply.trim()
          : 'Our concierge is here to help! Please reach us directly on WhatsApp (+92 317 8113817) for instant order & product assistance.';

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: 'model',
          text: replyText,
          suggestedProducts: Array.isArray(data?.suggestedProducts) ? data.suggestedProducts : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: 'model',
          text: 'Connection issue. Aap WhatsApp button par click kar ke hamari team se seedha rabta kar sakte hain (+92 317 8113817).',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const quickPrompts = [
    { label: 'Bridal Bangles', query: 'Show bridal bangles and prices' },
    { label: 'Delivery Charges', query: 'What are delivery charges and free shipping limit?' },
    { label: 'Track Order', query: 'How can I track my order?' },
    { label: 'Store Address', query: 'What is your Karachi store address and timings?' },
  ];

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 print:hidden">
      {/* Chat Drawer Panel */}
      {isOpen && (
        <div className="mb-3 w-[calc(100vw-2rem)] sm:w-[390px] h-[72vh] max-h-[550px] bg-[#0c0a07]/98 backdrop-blur-2xl border border-[#3b2e1b] rounded-2xl shadow-2xl shadow-black/90 flex flex-col overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="p-3.5 sm:p-4 bg-[#141009] border-b border-[#292014] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#D6B16D] to-[#9E7426] text-black flex items-center justify-center shrink-0 shadow-md">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-serif font-bold text-white truncate">
                  ZN Jewelers Concierge
                </h3>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  <span>Online • English & Roman Urdu</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 transition-colors"
                title="Chat directly on WhatsApp"
              >
                <MessageCircle className="w-3 h-3" />
                <span>WhatsApp</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Close Concierge Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 leading-relaxed whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-[#D6B16D] to-[#C29B53] text-black font-medium rounded-br-sm'
                      : 'bg-[#16120b] border border-[#2c2316] text-neutral-200 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Clickable Matching Product Cards */}
                {msg.role === 'model' && msg.suggestedProducts && msg.suggestedProducts.length > 0 && (
                  <div className="mt-2 w-full max-w-[92%] space-y-1.5">
                    {msg.suggestedProducts.map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => {
                          const fullProd = getProductById(sp.id);
                          if (fullProd) {
                            onSelectProduct(fullProd);
                            setIsOpen(false);
                          }
                        }}
                        className="w-full p-2 rounded-xl bg-[#110e09] border border-[#2c2316] hover:border-[#D6B16D]/60 flex items-center gap-2.5 text-left transition-all group cursor-pointer"
                      >
                        <img
                          src={sp.image}
                          alt={sp.name}
                          className="w-10 h-10 rounded-lg object-cover border border-[#332716] shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/hero-steel.jpg';
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-serif font-semibold text-white group-hover:text-[#D6B16D] truncate">
                            {sp.name}
                          </p>
                          <div className="flex items-center justify-between text-[10px] mt-0.5">
                            <span className="font-mono text-[#D6B16D] font-bold">
                              {formatPKR(sp.price)}
                            </span>
                            <span className="text-neutral-400">
                              {sp.stock > 0 ? 'View Piece →' : 'Sold Out'}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex items-start">
                <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-[#16120b] border border-[#2c2316] text-neutral-400 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D6B16D]" />
                  <span>Checking ZN Jewelers catalogue...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies + Shortcuts */}
          <div className="px-3 py-2 border-t border-[#1e1810] bg-[#0f0c08] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {quickPrompts.map((qp) => (
              <button
                key={qp.label}
                type="button"
                onClick={() => void sendMessage(qp.query)}
                disabled={sending}
                className="px-2.5 py-1 rounded-full bg-[#19140c] border border-[#322717] hover:border-[#D6B16D] text-[10px] text-neutral-300 hover:text-[#D6B16D] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                {qp.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onNavigateTracking();
              }}
              className="px-2.5 py-1 rounded-full bg-[#19140c] border border-[#322717] hover:border-[#D6B16D] text-[10px] text-[#D6B16D] whitespace-nowrap shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Truck className="w-3 h-3" />
              <span>Track Page</span>
            </button>
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
            className="p-3 bg-[#110e09] border-t border-[#241c11] flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask in English or Roman Urdu..."
              className="flex-1 bg-[#18130b] border border-[#2f2416] rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D6B16D]"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="p-2 rounded-lg bg-[#D6B16D] text-black hover:bg-[#F4E0A5] disabled:opacity-40 transition-colors shrink-0 cursor-pointer"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Subtle Store Footer Strip */}
          <div className="px-3 py-1.5 bg-[#090705] border-t border-[#1b150d] flex items-center justify-between text-[10px] text-neutral-500">
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 text-[#D6B16D] shrink-0" />
              <span className="truncate">Aman Tower, Korangi Crossing</span>
            </span>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline flex items-center gap-1 shrink-0 font-medium"
            >
              <ShoppingBag className="w-3 h-3" />
              <span>WhatsApp Order</span>
            </a>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="ml-auto flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-[#D6B16D] via-[#F4E0A5] to-[#C29B53] text-black font-semibold text-xs uppercase tracking-wider shadow-[0_6px_28px_rgba(214,177,109,0.4)] hover:shadow-[0_8px_34px_rgba(214,177,109,0.55)] hover:scale-[1.03] transition-all cursor-pointer"
        aria-label={isOpen ? 'Close ZN Concierge Chat' : 'Open ZN Concierge Chat'}
      >
        {isOpen ? (
          <>
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Close</span>
          </>
        ) : (
          <>
            <MessageCircle className="w-4 h-4" />
            <span>ZN Concierge</span>
          </>
        )}
      </button>
    </div>
  );
};
