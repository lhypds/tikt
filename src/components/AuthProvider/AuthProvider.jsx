import { createContext, useContext, useEffect, useState } from "react";
import * as api from "../../api.js";

const storageKey = "tikt:user";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const storedUsername = localStorage.getItem(storageKey);

    async function restore() {
      try {
        const data = await api.getSession();
        if (!cancelled) setUser(data.user);
      } catch {
        if (storedUsername) {
          try {
            const data = await api.login(storedUsername);
            if (!cancelled) setUser(data.user);
          } catch {
            localStorage.removeItem(storageKey);
          }
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(username) {
    const data = await api.login(username);
    localStorage.setItem(storageKey, data.user.username);
    setUser(data.user);
    return data.user;
  }

  async function register(details) {
    const data = await api.createUser(details);
    localStorage.setItem(storageKey, data.user.username);
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await api.logout().catch(() => {});
    localStorage.removeItem(storageKey);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, ready, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
