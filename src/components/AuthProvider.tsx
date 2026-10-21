"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { useClerk, useSession } from "@clerk/nextjs";
import {
  firebaseSignIn,
  firebaseSignUp,
  firebaseSignInAnonymously,
  firebaseSignOut,
  onFirebaseAuthChange,
} from "@/lib/firebase/auth";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { apiUrl } from "@/lib/network/api-url";

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  /** True when Firebase is configured and the app runs on Firebase auth. */
  firebaseMode: boolean;
  /** True when Clerk is configured and drives the sign-in UI. */
  clerkMode: boolean;
  /** True while the Clerk→FoodGuard token exchange is in flight. */
  isExchanging: boolean;
  /** The current Firebase user (null in JWT fallback mode). */
  firebaseUser: User | null;
  login: (token: string) => void;
  logout: () => void;
  /** Firebase email/password sign-in (throws on failure). */
  signIn: (email: string, password: string) => Promise<void>;
  /** Firebase account creation. */
  signUp: (email: string, password: string) => Promise<void>;
  /** Firebase anonymous "continue as guest". */
  continueAsGuest: () => Promise<void>;
  /** Exchange the current Clerk session for a FoodGuard JWT. */
  exchangeClerkSession: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "foodgaurd-token";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Clerk is configured when the publishable key was inlined at build time. */
function isClerkConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const clerk = useClerk();
  // `useSession` re-renders when Clerk finishes loading or the session
  // changes — `useClerk()` alone does not, which previously left `isLoading`
  // stuck on true and every guarded page spinning forever.
  const { session, isLoaded: clerkLoaded } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExchanging, setIsExchanging] = useState(false);

  const firebaseMode = useMemo(() => isFirebaseConfigured(), []);
  const clerkMode = useMemo(() => isClerkConfigured(), []);

  const login = useCallback((nextToken: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, nextToken);
    } catch {
      /* storage may be unavailable */
    }
    setToken(nextToken);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage may be unavailable */
    }
    setToken(null);
    if (firebaseMode) {
      void firebaseSignOut();
    }
    if (clerkMode) {
      void clerk.signOut();
    }
  }, [firebaseMode, clerkMode, clerk]);

  const exchangeClerkSession = useCallback(async (): Promise<boolean> => {
    if (!session) return false;
    setIsExchanging(true);
    try {
      // Ask Clerk for a fresh session token, then swap it for this app's JWT.
      const sessionToken = await session.getToken().catch(() => null);
      if (!sessionToken) return false;

      const response = await fetch(apiUrl("/api/auth/clerk"), {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!response.ok) return false;

      const json = (await response.json()) as {
        success: boolean;
        data?: { token: string };
      };
      if (!json.success || !json.data?.token) return false;

      login(json.data.token);
      return true;
    } finally {
      setIsExchanging(false);
    }
  }, [session, login]);

  useEffect(() => {
    if (clerkMode) {
      // Wait for Clerk to report its loaded state before deciding anything.
      if (!clerkLoaded) return;

      if (!session) {
        // Signed out of Clerk; fall back to a stored JWT if one exists
        // (e.g. from a previous email/password session).
        setToken(getStoredToken());
        setIsLoading(false);
        return;
      }

      // Signed in: refresh the FoodGuard JWT for this session, keeping the
      // user's history/gamification even if the Clerk session renewed.
      let cancelled = false;
      setIsLoading(true);
      void exchangeClerkSession()
        .then((exchanged) => {
          if (cancelled) return;
          if (!exchanged) setToken(getStoredToken());
        })
        .catch(() => {
          if (!cancelled) setToken(getStoredToken());
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    if (!firebaseMode) {
      const tokenFromStorage = getStoredToken();
      queueMicrotask(() => {
        setToken(tokenFromStorage);
        setIsLoading(false);
      });
      return;
    }

    const unsubscribe = onFirebaseAuthChange((user) => {
      setFirebaseUser(user);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [firebaseMode, clerkMode, clerkLoaded, session, exchangeClerkSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    await firebaseSignIn(email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    await firebaseSignUp(email, password);
  }, []);

  const continueAsGuest = useCallback(async () => {
    await firebaseSignInAnonymously();
  }, []);

  /*
   * Pure, synchronous derivation only — calling `exchangeClerkSession()`
   * here would setState during render and loop forever.
   *
   * In Clerk mode a live Clerk session alone is NOT enough: the app's API
   * calls authenticate with the exchanged FoodGuard JWT, so `isAuthenticated`
   * requires that token to exist (it is set by `login()` once the exchange
   * succeeds, or falls back to a previously stored one). While the exchange
   * runs, `isLoading` is true and guarded pages keep showing the spinner
   * instead of rendering a dashboard full of 401s.
   */
  const isAuthenticated = firebaseMode
    ? Boolean(firebaseUser)
    : clerkMode
      ? clerkLoaded && Boolean(session) && Boolean(token)
      : Boolean(token);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      firebaseMode,
      clerkMode,
      isExchanging,
      firebaseUser,
      login,
      logout,
      signIn,
      signUp,
      continueAsGuest,
      exchangeClerkSession,
    }),
    [
      isAuthenticated,
      isLoading,
      firebaseMode,
      clerkMode,
      isExchanging,
      firebaseUser,
      login,
      logout,
      signIn,
      signUp,
      continueAsGuest,
      exchangeClerkSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      isAuthenticated: false,
      isLoading: true,
      firebaseMode: false,
      clerkMode: false,
      isExchanging: false,
      firebaseUser: null,
      login: () => {},
      logout: () => {},
      signIn: async () => {},
      signUp: async () => {},
      continueAsGuest: async () => {},
      exchangeClerkSession: async () => false,
    };
  }
  return ctx;
}
