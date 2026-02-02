"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { UserProfile, UserRole, Resource, Permission, PermissionValue } from "@/types/auth";
import { ROLE_PERMISSIONS } from "@/types/auth";

// Auth State
interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

// Auth Context Type
interface AuthContextType extends AuthState {
  // Actions
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  
  // Role Checks
  role: UserRole | null;
  isAdmin: boolean;
  isMitarbeiter: boolean;
  isSubcontractor: boolean;
  isCustomer: boolean;
  
  // Permission Checks
  hasPermission: (resource: Resource, permission: Permission) => PermissionValue;
  canAccess: (resource: Resource, permission: Permission) => boolean;
}

// Default State
const defaultState: AuthState = {
  user: null,
  profile: null,
  session: null,
  loading: true,
  error: null,
};

// Context
const AuthContext = createContext<AuthContextType | null>(null);

// Provider
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(defaultState);
  const router = useRouter();
  const supabase = createClient();

  // Fetch User Profile
  const fetchProfile = useCallback(async (authId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", authId)
      .eq("active", true)
      .single();

    if (error || !data) {
      console.error("Profile fetch error:", error);
      return null;
    }

    return data as UserProfile;
  }, [supabase]);

  // Initialize Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setState({
            user: session.user,
            profile,
            session,
            loading: false,
            error: profile ? null : "Kein aktives Profil gefunden",
          });
        } else {
          setState({ ...defaultState, loading: false });
        }
      } catch (err) {
        setState({
          ...defaultState,
          loading: false,
          error: "Auth-Fehler",
        });
        console.error("Auth init error:", err);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          const profile = await fetchProfile(session.user.id);
          setState({
            user: session.user,
            profile,
            session,
            loading: false,
            error: profile ? null : "Kein aktives Profil gefunden",
          });
        } else if (event === "SIGNED_OUT") {
          setState({ ...defaultState, loading: false });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  // Sign In
  const signIn = async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setState((s) => ({
        ...s,
        loading: false,
        error: error.message === "Invalid login credentials"
          ? "Ungültige E-Mail oder Passwort"
          : error.message,
      }));
      return { error: error.message };
    }

    if (data.user) {
      const profile = await fetchProfile(data.user.id);
      
      if (!profile) {
        await supabase.auth.signOut();
        setState({
          ...defaultState,
          loading: false,
          error: "Kein aktives Benutzerprofil. Bitte kontaktiere einen Admin.",
        });
        return { error: "Kein aktives Profil" };
      }

      setState({
        user: data.user,
        profile,
        session: data.session,
        loading: false,
        error: null,
      });
    }

    return { error: null };
  };

  // Sign Out
  const signOut = async () => {
    setState((s) => ({ ...s, loading: true }));
    await supabase.auth.signOut();
    setState({ ...defaultState, loading: false });
    router.push("/login");
    router.refresh();
  };

  // Refresh Profile
  const refreshProfile = async () => {
    if (state.user) {
      const profile = await fetchProfile(state.user.id);
      setState((s) => ({ ...s, profile }));
    }
  };

  // Role
  const role = state.profile?.role ?? null;

  // Role Checks
  const isAdmin = role === "admin";
  const isMitarbeiter = role === "mitarbeiter";
  const isSubcontractor = role === "subcontractor";
  const isCustomer = role === "customer";

  // Permission Check
  const hasPermission = (resource: Resource, permission: Permission): PermissionValue => {
    if (!role) return false;
    // Map legacy roles (user/viewer) to mitarbeiter permissions
    const effectiveRole = (role === "user" || role === "viewer") ? "mitarbeiter" : role;
    const permissions = ROLE_PERMISSIONS[effectiveRole as keyof typeof ROLE_PERMISSIONS];
    return permissions?.[resource]?.[permission] ?? false;
  };

  // Can Access (boolean)
  const canAccess = (resource: Resource, permission: Permission): boolean => {
    const perm = hasPermission(resource, permission);
    return perm === true || perm === "assigned" || perm === "own";
  };

  const value: AuthContextType = {
    ...state,
    signIn,
    signOut,
    refreshProfile,
    role,
    isAdmin,
    isMitarbeiter,
    isSubcontractor,
    isCustomer,
    hasPermission,
    canAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
