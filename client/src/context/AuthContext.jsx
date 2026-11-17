import { createContext, useCallback, useContext, useMemo, useState } from "react";
import api from "../api/axios.js";
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from "../api/authStorage.js";

const AuthContext = createContext(null);

function readStoredUser() {
  const storedUser = localStorage.getItem(USER_STORAGE_KEY);
  if (!storedUser) return null;

  try {
    return JSON.parse(storedUser);
  } catch (error) {
    console.error("Could not read the saved user session:", error);
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY) ? readStoredUser() : null
  );

  const saveSession = useCallback((data) => {
    if (!data?.token || !data?.user) {
      throw new Error("The server returned an invalid authentication response");
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const { data } = await api.post("/auth/login", credentials);
      saveSession(data);
      return data.user;
    },
    [saveSession]
  );

  const signup = useCallback(
    async (details) => {
      const { data } = await api.post("/auth/signup", details);
      saveSession(data);
      return data.user;
    },
    [saveSession]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, login, signup, logout }),
    [token, user, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
