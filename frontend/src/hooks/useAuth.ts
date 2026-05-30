import { useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "../lib/firebase";
import type { UserRole } from "../types";

interface AuthState {
  user: User | null;
  loading: boolean;
  role: UserRole;
  hasProfile: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    role: "volunteer",
    hasProfile: false,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        let role: UserRole = "volunteer";
        try {
          const tokenResult = await user.getIdTokenResult();
          role = (tokenResult.claims.role as UserRole) || "volunteer";
        } catch (e) {
          console.warn("Failed to get token claims:", e);
        }

        let hasProfile = false;
        try {
          const profileDoc = await getDoc(doc(db, "volunteers", user.uid));
          hasProfile = profileDoc.exists();
        } catch (e) {
          console.warn("Failed to check profile (Firestore may not be ready):", e);
        }

        setState({ user, loading: false, role, hasProfile });
      } else {
        setState({ user: null, loading: false, role: "volunteer", hasProfile: false });
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      console.error("Sign-in failed:", e.message);
    }
  };

  const signOut = () => firebaseSignOut(auth);

  return { ...state, signIn, signOut };
}
