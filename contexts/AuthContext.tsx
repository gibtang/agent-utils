'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useKindeBrowserClient, LoginLink, RegisterLink, LogoutLink } from '@kinde-oss/kinde-auth-nextjs';

interface UserProfile {
  _id: string;
  kindeId: string;
  email: string;
  name: string;
  tier: string;
  isNew?: boolean;
  createdAt: string;
  keyCount?: number;
}

interface KindeUser {
  id: string;
  email: string | null;
  given_name: string | null;
  family_name: string | null;
  picture: string | null;
}

interface AuthContextType {
  user: KindeUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshProfile: () => Promise<void>;
  ensureProfile: () => Promise<void>;
  LoginLink: typeof LoginLink;
  RegisterLink: typeof RegisterLink;
  LogoutLink: typeof LogoutLink;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthenticated: false,
  refreshProfile: async () => {},
  ensureProfile: async () => {},
  LoginLink,
  RegisterLink,
  LogoutLink,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: kindeUser, isAuthenticated, isLoading, getAccessTokenRaw } = useKindeBrowserClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const hasSynced = useRef(false);

  const upsertUser = useCallback(async () => {
    if (!kindeUser?.id || !kindeUser?.email) return false;
    try {
      const token = await getAccessTokenRaw();
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          kindeId: kindeUser.id,
          email: kindeUser.email,
          name: kindeUser.given_name || '',
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
  }, [kindeUser, getAccessTokenRaw]);

  const refreshProfile = useCallback(async () => {
    if (!kindeUser?.id) return;
    try {
      const token = await getAccessTokenRaw();
      const res = await fetch('/api/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (json.success) {
        setProfile(json.data);
      }
    } catch (err) {
      console.error('Profile refresh failed:', err);
    }
  }, [kindeUser, getAccessTokenRaw]);

  // Call from consuming components on mount to sync profile
  const ensureProfile = useCallback(async () => {
    if (hasSynced.current) return;
    hasSynced.current = true;
    if (!isAuthenticated || !kindeUser) return;
    await upsertUser();
  }, [isAuthenticated, kindeUser, upsertUser]);

  const user: KindeUser | null = kindeUser ? {
    id: kindeUser.id,
    email: kindeUser.email,
    given_name: kindeUser.given_name,
    family_name: kindeUser.family_name,
    picture: kindeUser.picture,
  } : null;

  return (
    <AuthContext.Provider value={{ user, profile, loading: isLoading === true, isAuthenticated: isAuthenticated === true, refreshProfile, ensureProfile, LoginLink, RegisterLink, LogoutLink }}>
      {children}
    </AuthContext.Provider>
  );
}
