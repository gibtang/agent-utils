'use client';

/**
 * AgentUtils foundation — AuthProvider.
 *
 * Wraps the app in a Firebase-Auth-backed context. Google is the only sign-in
 * method. When a user is present it POSTs their ID token to /api/auth/sync,
 * which idempotently provisions the owner's Account and reports onboarding
 * state — the handshake issues NO credentials of any kind.
 *
 * Exposes useAuth(): { user, loading, syncError, clearSyncError,
 * signInWithGoogle, logout, getIdToken }.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { trackSignUp } from '@/lib/analytics';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** Last error from /api/auth/sync (provisioning the owner's account). */
  syncError: string | null;
  clearSyncError: () => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  /** Current Firebase ID token for calling bearer-protected routes. */
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Cookie name mirroring client-side auth state so Next.js middleware (server /
 * edge) can gate routes without Firebase's IndexedDB-only session. This is a
 * ROUTING HINT ONLY — every protected resource is verified server-side via
 * lib/owner/auth (Firebase ID token → Account), so a forged cookie only ever
 * shows an empty shell, never another owner's data.
 */
const AUTH_COOKIE = '__au_authed';
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30d; kept in sync by onAuthStateChanged

function setAuthCookie(uid: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE}=${encodeURIComponent(uid)}; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax`;
}

function clearAuthCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const lastSyncedUid = useRef<string | null>(null);
  const firebaseUserRef = useRef<import('firebase/auth').User | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      // Auth not configured (missing env): nothing to subscribe to.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time external-system guard
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (fbUser) => {
      firebaseUserRef.current = fbUser;
      if (!fbUser) {
        setUser(null);
        clearAuthCookie();
        lastSyncedUid.current = null;
        setLoading(false);
        return;
      }
      setAuthCookie(fbUser.uid);
      setUser({
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
      });
      // Sync (account provisioning) only when the identity actually changes.
      if (lastSyncedUid.current !== fbUser.uid) {
        lastSyncedUid.current = fbUser.uid;
        try {
          const idToken = await fbUser.getIdToken();
          const res = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' },
          });
          if (res.ok) {
            const payload = (await res.json().catch(() => null)) as
              | { data?: { onboarding?: { isNewAccount?: boolean } } }
              | null;
            if (payload?.data?.onboarding?.isNewAccount) {
              trackSignUp('google');
            }
            setSyncError(null);
          } else {
            // Surface why account provisioning failed so the app can tell the
            // user (e.g. server missing the Firebase project env vars).
            const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
            setSyncError(
              j?.error?.message ??
                `Couldn't finish setting up your account (HTTP ${res.status}).`,
            );
          }
        } catch {
          setSyncError('Network error talking to the account service. Check your connection.');
        }
      }
      setLoading(false);
    });
  }, []);

  const signInWithGoogle = async () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Auth is not configured');
    await signInWithPopup(auth, new GoogleAuthProvider());
  };

  const logout = async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    setUser(null);
    clearAuthCookie();
    lastSyncedUid.current = null;
  };

  const getIdToken = async () => {
    return (await firebaseUserRef.current?.getIdToken()) ?? null;
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      syncError,
      clearSyncError: () => setSyncError(null),
      signInWithGoogle,
      logout,
      getIdToken,
    }),
    [user, loading, syncError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
