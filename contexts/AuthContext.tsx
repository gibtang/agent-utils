'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInWithPopup, GoogleAuthProvider, Auth } from 'firebase/auth';
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
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  logout: async () => {},
  signInWithGoogle: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseAuth, setFirebaseAuth] = useState<Auth | null>(null);

  const upsertUser = useCallback(async (firebaseUser: User) => {
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          firebaseUid: firebaseUser.uid,
          email: firebaseUser.email,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setProfile(json.data.user);
        return json.data.isNew;
      }
    } catch (err) {
      console.error('User upsert failed:', err);
    }
    return false;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/user', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });
      const json = await res.json();
      if (json.success) {
        setProfile(json.data);
      }
    } catch (err) {
      console.error('Profile refresh failed:', err);
    }
  }, [user]);

  useEffect(() => {
    const initFirebase = async () => {
      const { auth } = await firebaseInitializationPromise;
      setFirebaseAuth(auth);

      if (auth) {
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
      } else {
        setLoading(false);
      }
    };

    initFirebase();
  }, [upsertUser]);

  const signIn = async (email: string, password: string) => {
    if (!firebaseAuth) throw new Error('Firebase not initialized');
    await signInWithEmailAndPassword(firebaseAuth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    if (!firebaseAuth) throw new Error('Firebase not initialized');
    await createUserWithEmailAndPassword(firebaseAuth, email, password);
  };

  const logout = async () => {
    if (!firebaseAuth) throw new Error('Firebase not initialized');
    await signOut(firebaseAuth);
    setProfile(null);
  };

  const signInWithGoogle = async () => {
    if (!firebaseAuth) throw new Error('Firebase not initialized');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(firebaseAuth, provider);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, logout, signInWithGoogle, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
