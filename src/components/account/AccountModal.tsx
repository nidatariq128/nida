import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  LogOut,
  ShoppingBag,
  Heart,
  Clock,
  Truck,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useProducts } from '../../context/ProductContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Order, Product } from '../../types';
import { formatPKR, formatDate } from '../../lib/formatters';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackOrder: (orderNumber: string, phone: string) => void;
  onQuickViewProduct: (product: Product) => void;
  onOpenAdmin?: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onTrackOrder,
  onOpenAdmin,
}) => {
  const {
    user,
    profile,
    isAdmin,
    authError,
    clearAuthError,
    loginWithGoogle,
    logout,
    wishlist,
    toggleWishlist,
    updateUserProfile,
  } = useAuth();
  const { addToCart } = useCart();
  const { products } = useProducts();

  const [activeTab, setActiveTab] = useState<'orders' | 'wishlist' | 'profile'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Profile edit state
  const [phoneInput, setPhoneInput] = useState('');
  const [streetInput, setStreetInput] = useState('');
  const [cityInput, setCityInput] = useState('Karachi');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setPhoneInput(profile.phone || '');
      const defaultAddr = profile.addresses?.[0];
      setStreetInput(defaultAddr?.street || '');
      setCityInput(defaultAddr?.city || 'Karachi');
    }
  }, [profile]);

  useEffect(() => {
    if (isOpen) {
      clearAuthError();
      if (user) {
        fetchUserOrders(user.uid);
      }
    }
  }, [isOpen, user, clearAuthError]);

  const fetchUserOrders = async (uid: string) => {
    setLoadingOrders(true);
    setOrdersError(null);
    const merged = new Map<string, Order>();

    try {
      const q = query(collection(db, 'orders'), where('userId', '==', uid));
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const ord = { id: d.id, ...d.data() } as Order;
        merged.set(ord.orderNumber, ord);
      });
    } catch (e) {
      console.warn('Firestore orders read note:', e);
    }

    try {
      if (user) {
        const token = await user.getIdToken();
        const res = await fetch('/api/orders/my', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.orders)) {
            for (const ord of data.orders as Order[]) {
              if (!merged.has(ord.orderNumber)) {
                merged.set(ord.orderNumber, ord);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Server my orders fetch note:', e);
      if (merged.size === 0) {
        setOrdersError('Unable to retrieve online order history right now.');
      }
    } finally {
      const sorted = Array.from(merged.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOrders(sorted);
      setLoadingOrders(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileFeedback(null);
    try {
      const nextAddresses = streetInput.trim()
        ? [{ label: 'Primary', street: streetInput.trim(), city: cityInput.trim() || 'Karachi', isDefault: true }]
        : [];
      await updateUserProfile({
        phone: phoneInput.trim(),
        addresses: nextAddresses,
      });
      setProfileFeedback('Profile and delivery details updated.');
      setTimeout(() => setProfileFeedback(null), 3500);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setProfileFeedback('Failed to update profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      await loginWithGoogle();
    } catch (e) {
      console.error(e);
    } finally {
      setAuthLoading(false);
    }
  };

  const wishlistProducts = products.filter((p) => wishlist.includes(p.id));

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-[#0c0a07] border border-[#3b2e1b] rounded-2xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-3.5 sm:p-5 border-b border-[#211a10] flex items-center justify-between gap-2 bg-[#110e09] shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#18130a] border border-[#3b2e1b] text-[#D6B16D] flex items-center justify-center shrink-0">
              <UserIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-[0.22em] text-[#D6B16D] font-bold block">
                Client Boutique Portal
              </span>
              <h3 className="text-sm sm:text-base font-serif font-semibold text-white truncate">
                {user ? profile?.displayName || user.email : 'VIP Client Sign In'}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {user && (
              <button
                onClick={logout}
                className="px-2.5 py-1.5 rounded-lg bg-[#18130a] border border-[#2d2214] text-xs text-neutral-300 hover:text-rose-400 hover:border-rose-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-[11px]">Sign Out</span>
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close Account Portal"
              className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Not Logged In View */}
        {!user ? (
          <div className="p-5 sm:p-8 text-center space-y-6 overflow-y-auto flex-1 overscroll-contain">
            <div className="max-w-md mx-auto space-y-3">
              <h4 className="text-2xl font-serif text-white">Welcome to ZN JEWELLERS</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Sign in with your verified credentials to access your private orders, saved heirloom wishlist, and bespoke atelier consultations.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-sm mx-auto">
              <button
                onClick={handleGoogleLogin}
                disabled={authLoading}
                className="w-full py-3.5 px-6 rounded-lg bg-white text-black font-semibold text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                  <path fill="#34A853" d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.22 1.18-3.25 0-6-2.19-6.98-5.14H1.01v3.14C3.05 21.22 7.21 24 12 24Z" />
                  <path fill="#FBBC05" d="M5.02 14.03A7.2 7.2 0 0 1 4.64 12c0-.7.13-1.39.38-2.03V6.83H1.01A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.01 5.17l4.01-3.14Z" />
                  <path fill="#EA4335" d="M12 4.83c1.8 0 3.41.62 4.68 1.83l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.05 2.78 1.01 6.83l4.01 3.14C6 7.02 8.75 4.83 12 4.83Z" />
                </svg>
                <span>{authLoading ? 'Signing In...' : 'Continue with Google'}</span>
              </button>
            </div>

            {authError && (
              <div className="max-w-md mx-auto p-3.5 rounded-lg bg-red-950/70 border border-red-700/60 text-red-200 text-xs flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <div className="pt-4 border-t border-[#1f180f] text-[11px] text-neutral-500">
              *Guest orders can always be tracked directly using order reference number & phone.
            </div>
          </div>
        ) : (
          <>
            {/* Responsive Tabs Bar — All 3 tabs visible on mobile without clipping */}
            <div className="px-2.5 sm:px-6 py-2 bg-[#080705] border-b border-[#1c160e] shrink-0">
              <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-6 text-[11px] sm:text-xs uppercase tracking-wider">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`py-2 px-1.5 sm:px-0 sm:py-1.5 rounded-lg sm:rounded-none transition-colors flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer ${
                    activeTab === 'orders'
                      ? 'bg-[#1a140a] sm:bg-transparent text-[#D6B16D] border border-[#3b2e1b] sm:border-0 sm:border-b-2 sm:border-[#D6B16D] font-semibold'
                      : 'text-neutral-400 hover:text-white border border-transparent'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    <span className="sm:hidden">Orders ({orders.length})</span>
                    <span className="hidden sm:inline">Order History ({orders.length})</span>
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('wishlist')}
                  className={`py-2 px-1.5 sm:px-0 sm:py-1.5 rounded-lg sm:rounded-none transition-colors flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer ${
                    activeTab === 'wishlist'
                      ? 'bg-[#1a140a] sm:bg-transparent text-[#D6B16D] border border-[#3b2e1b] sm:border-0 sm:border-b-2 sm:border-[#D6B16D] font-semibold'
                      : 'text-neutral-400 hover:text-white border border-transparent'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    <span className="sm:hidden">Wishlist ({wishlist.length})</span>
                    <span className="hidden sm:inline">Saved Wishlist ({wishlist.length})</span>
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('profile')}
                  className={`py-2 px-1.5 sm:px-0 sm:py-1.5 rounded-lg sm:rounded-none transition-colors flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer ${
                    activeTab === 'profile'
                      ? 'bg-[#1a140a] sm:bg-transparent text-[#D6B16D] border border-[#3b2e1b] sm:border-0 sm:border-b-2 sm:border-[#D6B16D] font-semibold'
                      : 'text-neutral-400 hover:text-white border border-transparent'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    <span className="sm:hidden">Profile</span>
                    <span className="hidden sm:inline">Profile & Addresses</span>
                  </span>
                </button>
              </div>
            </div>

            {/* Single Clean Scrollable Tab Body */}
            <div className="p-3.5 sm:p-6 flex-1 overflow-y-auto overscroll-contain space-y-4">
              {/* TAB 1: Orders */}
              {activeTab === 'orders' && (
                <div className="space-y-4">
                  {ordersError && (
                    <div className="p-3 rounded-lg bg-red-950/60 border border-red-700/50 text-xs text-red-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{ordersError}</span>
                    </div>
                  )}
                  {loadingOrders ? (
                    <div className="py-12 text-center text-xs text-neutral-400">
                      Loading your luxury orders...
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="py-12 text-center space-y-3">
                      <ShoppingBag className="w-8 h-8 text-neutral-600 mx-auto" />
                      <p className="text-xs text-neutral-400">
                        You have not placed any orders under this account yet.
                      </p>
                    </div>
                  ) : (
                    orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-5 rounded-xl bg-[#110e09] border border-[#241c11] space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1e170e]">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-[#D6B16D] font-bold block">
                              Order Reference
                            </span>
                            <span className="text-sm font-mono font-bold text-white">
                              {ord.orderNumber}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-[#D6B16D]/20 text-[#D6B16D] border border-[#D6B16D]/40">
                              {ord.orderStatus}
                            </span>
                            <span className="text-xs text-neutral-400">
                              {formatDate(ord.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Items preview */}
                        <div className="space-y-2">
                          {ord.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-8 h-8 rounded object-cover"
                                />
                                <span className="text-white font-medium">
                                  {item.name} (x{item.quantity})
                                </span>
                              </div>
                              <span className="font-mono text-neutral-300">
                                {formatPKR(item.price * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-3 border-t border-[#1e170e] flex items-center justify-between">
                          <div className="text-xs">
                            <span className="text-neutral-400">Total: </span>
                            <strong className="text-white font-mono">{formatPKR(ord.total)}</strong>
                          </div>

                          <button
                            onClick={() => {
                              onClose();
                              onTrackOrder(ord.orderNumber, ord.customerPhone);
                            }}
                            className="px-4 py-1.5 bg-[#17130a] border border-[#3d311c] text-[#D6B16D] text-xs font-semibold rounded hover:bg-[#D6B16D] hover:text-black transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Track Parcel</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 2: Wishlist */}
              {activeTab === 'wishlist' && (
                <div className="space-y-4">
                  {wishlistProducts.length === 0 ? (
                    <div className="py-12 text-center space-y-3">
                      <Heart className="w-8 h-8 text-neutral-600 mx-auto" />
                      <p className="text-xs text-neutral-400">Your wishlist is currently empty.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {wishlistProducts.map((p) => (
                        <div
                          key={p.id}
                          className="p-4 rounded-xl bg-[#110e09] border border-[#241c11] flex gap-3 relative group"
                        >
                          <img
                            src={p.images[0]}
                            alt={p.name}
                            className="w-16 h-16 rounded object-cover"
                          />
                          <div className="flex-1 min-w-0 space-y-1">
                            <h5 className="text-xs font-serif font-semibold text-white truncate">
                              {p.name}
                            </h5>
                            <span className="text-xs font-mono text-[#D6B16D] block">
                              {formatPKR(p.salePrice ?? p.price)}
                            </span>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => {
                                  addToCart(p);
                                  toggleWishlist(p.id);
                                }}
                                disabled={p.stock <= 0}
                                className="px-2.5 py-1 bg-[#D6B16D] text-black text-[10px] uppercase font-bold tracking-wider rounded hover:bg-[#F4E0A5] disabled:opacity-40"
                              >
                                {p.stock > 0 ? 'Move to Bag' : 'Sold Out'}
                              </button>
                              <button
                                onClick={() => toggleWishlist(p.id)}
                                className="text-neutral-500 hover:text-red-400 p-1"
                                title="Remove"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Profile */}
              {activeTab === 'profile' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-xl bg-[#110e09] border border-[#241c11] space-y-2">
                    <span className="text-[10px] uppercase text-[#D6B16D] font-bold tracking-wider block">
                      Account Credentials
                    </span>
                    <p className="text-neutral-300">
                      <strong>Name:</strong> {profile?.displayName || user.displayName || 'Patron'}
                    </p>
                    <p className="text-neutral-300">
                      <strong>Email:</strong> {user.email}
                    </p>
                    <p className="text-neutral-300">
                      <strong>Role:</strong> {isAdmin ? 'Verified Administrator' : 'Privileged Patron'}
                    </p>
                    {isAdmin && onOpenAdmin && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={onOpenAdmin}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#D6B16D]/20 to-[#F4E0A5]/15 border border-[#D6B16D]/60 text-[#D6B16D] text-xs font-semibold uppercase tracking-wider hover:bg-[#D6B16D] hover:text-black transition-colors cursor-pointer flex items-center justify-center gap-2"
                        >
                          <ShieldCheck className="w-4 h-4 shrink-0" />
                          <span>Open Admin Management Portal</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <form
                    onSubmit={handleSaveProfile}
                    className="p-4 rounded-xl bg-[#110e09] border border-[#241c11] space-y-3"
                  >
                    <span className="text-[10px] uppercase text-[#D6B16D] font-bold tracking-wider block">
                      Contact & Default Delivery Address
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1">
                          Mobile / WhatsApp Number
                        </label>
                        <input
                          type="tel"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          placeholder="e.g. +92 317 8113817"
                          className="w-full bg-[#15110a] border border-[#2f2416] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1">City</label>
                        <input
                          type="text"
                          value={cityInput}
                          onChange={(e) => setCityInput(e.target.value)}
                          placeholder="Karachi"
                          className="w-full bg-[#15110a] border border-[#2f2416] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-neutral-400 mb-1">
                        Street / House Address
                      </label>
                      <input
                        type="text"
                        value={streetInput}
                        onChange={(e) => setStreetInput(e.target.value)}
                        placeholder="Enter your delivery address for faster checkout..."
                        className="w-full bg-[#15110a] border border-[#2f2416] rounded px-3 py-2 text-white focus:outline-none focus:border-[#D6B16D]"
                      />
                    </div>

                    {profileFeedback && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{profileFeedback}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-4 py-2 bg-[#D6B16D] text-black text-xs font-semibold uppercase tracking-wider rounded hover:bg-[#F4E0A5] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
