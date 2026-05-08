'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

interface UserProfile {
  _id: string;
  firebaseUid: string;
  email: string;
  name: string;
  tier: string;
  isNew?: boolean;
  createdAt: string;
  keyCount?: number;
  defaultKey?: string | null;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshProfile: () => Promise<void>;
  ensureProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthenticated: false,
  refreshProfile: async () => {},
  ensureProfile: async () => {},
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const upsertUser = useCallback(async (firebaseUser: FirebaseUser) => {
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          firebaseUid: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || '',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setProfile({ ...json.data.user, defaultKey: json.data.apiKey || null });
        return json.data.isNew;
      }
    } catch (err) {
      console.error('User upsert error:', err);
    }
    return false;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await upsertUser(firebaseUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [upsertUser]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/user', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setProfile(json.data);
      }
    } catch (err) {
      console.error('Refresh profile error:', err);
    }
  }, [user]);

  const ensureProfile = useCallback(async () => {
    if (!profile && user) {
      await upsertUser(user);
    }
  }, [profile, user, upsertUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await firebaseUpdateProfile(credential.user, { displayName: name });
    await upsertUser(credential.user);
  }, [upsertUser]);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const logout = useCallback(async () => {
    await firebaseSignOut(auth);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isAuthenticated: !!user,
      refreshProfile,
      ensureProfile,
      signIn,
      signUp,
      signInWithGoogle,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
