'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile as firebaseUpdateProfile,
  Auth,
} from 'firebase/auth';
import { firebaseInitializationPromise } from '@/lib/firebase';

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseAuth, setFirebaseAuth] = useState<Auth | null>(null);

  // Initialize Firebase Auth — matches check-mcc pattern
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { auth } = await firebaseInitializationPromise;
        if (!auth) {
          setLoading(false);
          return;
        }
        setFirebaseAuth(auth);
      } catch (error) {
        console.error('Error initializing auth:', error);
        setLoading(false);
      }
    };

    initAuth();
  }, []);

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

  // Auth state listener — only after firebaseAuth is ready
  useEffect(() => {
    if (!firebaseAuth) return;

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await upsertUser(firebaseUser);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseAuth, upsertUser]);

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
    if (!firebaseAuth) throw new Error('Auth not initialized');
    await signInWithEmailAndPassword(firebaseAuth, email, password);
  }, [firebaseAuth]);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    if (!firebaseAuth) throw new Error('Auth not initialized');
    const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    await firebaseUpdateProfile(credential.user, { displayName: name });
    await upsertUser(credential.user);
  }, [firebaseAuth, upsertUser]);

  const signInWithGoogle = useCallback(async () => {
    if (!firebaseAuth) throw new Error('Auth not initialized');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(firebaseAuth, provider);
  }, [firebaseAuth]);

  const logout = useCallback(async () => {
    if (!firebaseAuth) throw new Error('Auth not initialized');
    await firebaseSignOut(firebaseAuth);
    setProfile(null);
  }, [firebaseAuth]);

  const value = {
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
