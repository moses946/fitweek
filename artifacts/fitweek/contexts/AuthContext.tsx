import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthStore, AuthState, AuthContextValue } from "../lib/authStore";
import { SupabaseAuthAdapter } from "../lib/authAdapters";

const AuthContext = createContext<AuthContextValue | null>(null);

// Singleton store instance
const store = new AuthStore(SupabaseAuthAdapter);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(store.getState());

  useEffect(() => {
    store.init();
    return store.subscribe(setState);
  }, []);

  const value: AuthContextValue = {
    ...state,
    signIn: () => store.signIn(),
    signInWithEmail: (e, p) => store.signInWithEmail(e, p),
    signUpWithEmail: (e, p) => store.signUpWithEmail(e, p),
    signOut: () => store.signOut(),
    completeOnboarding: (url) => store.completeOnboarding(url),
    updateBirthdate: (b) => store.updateBirthdate(b),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
