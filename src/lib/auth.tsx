import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { TeacherProfile } from "../../shared/protocol";
import { api } from "./api";

interface AuthState {
  teacher: TeacherProfile | null;
  loading: boolean;
  refresh: () => Promise<TeacherProfile | null>;
  signOut: () => Promise<void>;
  setTeacher: (teacher: TeacherProfile | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { teacher: profile } = await api.auth.me();
      setTeacher(profile);
      return profile;
    } catch {
      setTeacher(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* cookie is cleared server-side when possible */
    }
    setTeacher(null);
  }, []);

  return (
    <AuthContext.Provider value={{ teacher, loading, refresh, signOut, setTeacher }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
