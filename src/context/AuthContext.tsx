import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';

// Legitimate store owners preserved across security hardening
const OWNER_ADMIN_EMAILS = new Set([
  'nidatariq6nov@gmail.com',
  'znjewelaers786@gmail.com',
]);

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  wishlist: string[];
  loginWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
  toggleWishlist: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  updateUserProfile: (
    updates: Partial<Pick<UserProfile, 'displayName' | 'phone' | 'addresses'>>
  ) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdminState, setIsAdminState] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('zn_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Keep wishlist synced with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('zn_wishlist', JSON.stringify(wishlist));
    } catch (e) {
      console.warn('LocalStorage wishlist write error', e);
    }
  }, [wishlist]);

  const resolveAdminAuthorization = useCallback(
    async (currentUser: FirebaseUser): Promise<boolean> => {
      if (!currentUser.emailVerified) {
        return false;
      }

      const emailLower = (currentUser.email || '').toLowerCase();

      // 1. Check Firebase custom claims
      try {
        const tokenResult = await currentUser.getIdTokenResult();
        if (tokenResult.claims?.custom_admin === true) {
          return true;
        }
      } catch (err) {
        console.warn('Token claim check warning:', err);
      }

      // 2. Check /admins/{uid} registry in Firestore
      try {
        const adminDocRef = doc(db, 'admins', currentUser.uid);
        const adminSnap = await getDoc(adminDocRef);
        if (adminSnap.exists()) {
          return true;
        }
        // Preserve legitimate store owners seamlessly by registering /admins/{uid} if allowlisted
        if (OWNER_ADMIN_EMAILS.has(emailLower)) {
          try {
            await setDoc(
              adminDocRef,
              {
                uid: currentUser.uid,
                email: emailLower,
                role: 'admin',
                createdAt: new Date().toISOString(),
              },
              { merge: true }
            );
          } catch {
            // Even if write fails offline, verified server & rules email allowlist preserves owner
          }
          return true;
        }
      } catch {
        if (OWNER_ADMIN_EMAILS.has(emailLower)) {
          return true;
        }
      }

      // 3. Server-side session verification
      try {
        const idToken = await currentUser.getIdToken();
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.isAdmin === true) {
            return true;
          }
        }
      } catch {
        // Offline or server unavailable
      }

      return false;
    },
    []
  );

  const syncUserSession = useCallback(
    async (currentUser: FirebaseUser | null) => {
      setUser(currentUser);
      if (currentUser) {
        const verifiedAdmin = await resolveAdminAuthorization(currentUser);
        setIsAdminState(verifiedAdmin);

        // Fetch or create customer profile in Firestore (never trust/grant client admin role here)
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setProfile({
              ...data,
              role: verifiedAdmin ? 'admin' : 'customer',
            });
          } else {
            const newProfile: UserProfile = {
              id: currentUser.uid,
              email: (currentUser.email || '').toLowerCase(),
              displayName: currentUser.displayName || 'Distinguished Patron',
              phone: currentUser.phoneNumber || '',
              role: 'customer',
              createdAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, newProfile);
            setProfile({
              ...newProfile,
              role: verifiedAdmin ? 'admin' : 'customer',
            });
          }

          // Fetch user's private wishlist from Firestore without stale closure
          const wishlistRef = doc(db, 'wishlists', currentUser.uid);
          const wishSnap = await getDoc(wishlistRef);
          if (wishSnap.exists()) {
            const data = wishSnap.data();
            if (Array.isArray(data.productIds)) {
              setWishlist((prev) =>
                Array.from(new Set([...prev, ...(data.productIds as string[])]))
              );
            }
          }
        } catch (err) {
          console.error('Error syncing user profile from Firestore:', err);
        }
      } else {
        setProfile(null);
        setIsAdminState(false);
      }
      setLoading(false);
    },
    [resolveAdminAuthorization]
  );

  // Auth observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      syncUserSession(currentUser);
    });
    return () => unsubscribe();
  }, [syncUserSession]);

  const refreshSession = async () => {
    if (auth.currentUser) {
      await syncUserSession(auth.currentUser);
    }
  };

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const formatAuthErrorMessage = (error: unknown): string => {
    const code = (error as { code?: string })?.code || '';
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    if (code === 'auth/unauthorized-domain') {
      return `Google Sign-In is blocked for domain "${host}". Please add "${host}" in Firebase Console → Project "${firebaseConfig.projectId}" → Authentication → Settings → Authorized domains.`;
    }
    if (code === 'auth/popup-blocked') {
      return 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return 'Sign-in was cancelled before completion.';
    }
    return error instanceof Error ? error.message : 'Unable to complete Google Sign-In.';
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      return true;
    } catch (error) {
      const msg = formatAuthErrorMessage(error);
      setAuthError(msg);
      console.warn('Google Sign-In notice:', msg);
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setProfile(null);
      setIsAdminState(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUserProfile = async (
    updates: Partial<Pick<UserProfile, 'displayName' | 'phone' | 'addresses'>>
  ) => {
    if (!user) {
      throw new Error('Authentication required to update profile.');
    }
    const nowIso = new Date().toISOString();
    const cleanUpdates: Record<string, unknown> = { updatedAt: nowIso };
    if (updates.displayName !== undefined) cleanUpdates.displayName = updates.displayName.trim();
    if (updates.phone !== undefined) cleanUpdates.phone = updates.phone.trim();
    if (updates.addresses !== undefined) cleanUpdates.addresses = updates.addresses;

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, cleanUpdates, { merge: true });
      setProfile((prev) =>
        prev
          ? { ...prev, ...updates, updatedAt: nowIso }
          : {
              id: user.uid,
              email: (user.email || '').toLowerCase(),
              displayName: updates.displayName || user.displayName || 'Distinguished Patron',
              phone: updates.phone || '',
              addresses: updates.addresses,
              role: isAdminState ? 'admin' : 'customer',
              createdAt: nowIso,
              updatedAt: nowIso,
            }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const toggleWishlist = async (productId: string) => {
    let nextWishlist: string[] = [];
    setWishlist((prev) => {
      nextWishlist = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      return nextWishlist;
    });

    if (user) {
      try {
        const wishDoc = doc(db, 'wishlists', user.uid);
        await setDoc(wishDoc, {
          userId: user.uid,
          productIds: nextWishlist,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `wishlists/${user.uid}`);
      }
    }
  };

  const isInWishlist = (productId: string) => wishlist.includes(productId);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin: isAdminState,
        loading,
        authError,
        clearAuthError,
        wishlist,
        loginWithGoogle,
        logout,
        toggleWishlist,
        isInWishlist,
        updateUserProfile,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
