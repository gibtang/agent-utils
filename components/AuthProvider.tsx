'use client';

/**
 * AgentUtils — AuthProvider.
 *
 * Wraps the app in a Firebase-Auth-backed context. On mount it initialises the
 * Firebase client SDK and registers onAuthStateChanged. When a user is present
 * it POSTs their ID token to /api/auth/sync, which upserts the user + hidden
 * tenant and (on first login) returns a one-time API key we surface to the UI.
 *
 * Exposes useAuth(): { user, loading, newKey, clearNewKey, signIn, signUp,
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
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/client';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface NewKey {
  agent_id: string;
  api_key: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  newKey: NewKey | null;
  /** Last error from /api/auth/sync (provisioning the user's account/keys). */
  syncError: string | null;
  clearNewKey: () => void;
  clearSyncError: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  /** Current Firebase ID token for calling bearer-protected routes. */
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState<NewKey | null>(null);
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
        lastSyncedUid.current = null;
        setLoading(false);
        return;
      }
      setUser({
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
      });
      // Sync (upsert + onboarding) only when the identity actually changes.
      if (lastSyncedUid.current !== fbUser.uid) {
        lastSyncedUid.current = fbUser.uid;
        try {
          const idToken = await fbUser.getIdToken();
          const res = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' },
          });
          if (res.ok) {
            const json = (await res.json()) as {
              data?: { new_key?: NewKey | null };
            };
            if (json.data?.new_key) setNewKey(json.data.new_key);
            setSyncError(null);
          } else {
            // Surface why account/key provisioning failed so the dashboard can
            // tell the user (e.g. "Auth is not configured" = server missing the
            // Firebase Admin service-account env vars).
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

  const signIn = async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Auth is not configured');
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Auth is not configured');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
  };

  const signInWithGoogle = async () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Auth is not configured');
    await signInWithPopup(auth, new GoogleAuthProvider());
  };

  const logout = async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    setUser(null);
    setNewKey(null);
    lastSyncedUid.current = null;
  };

  const getIdToken = async () => {
    return (await firebaseUserRef.current?.getIdToken()) ?? null;
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      newKey,
      syncError,
      clearNewKey: () => setNewKey(null),
      clearSyncError: () => setSyncError(null),
      signIn,
      signUp,
      signInWithGoogle,
      logout,
      getIdToken,
    }),
    [user, loading, newKey, syncError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
