import { useCallback, useEffect, useState, type ReactNode } from "react";
import { loginUser, registerUser } from "../api";
import { clearToken, getToken, setToken, setUnauthorizedHandler } from "../auth";
import { AuthContext } from "./auth-context";

function consumeRedirectToken(): boolean {
  const params = new URLSearchParams(window.location.search);
  const tokenFromRedirect = params.get("token");

  if (!tokenFromRedirect) {
    return false;
  }

  setToken(tokenFromRedirect);

  params.delete("token");
  const remaining = params.toString();
  const newUrl = `${window.location.pathname}${remaining ? `?${remaining}` : ""}`;
  window.history.replaceState({}, "", newUrl);

  return true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => consumeRedirectToken() || Boolean(getToken())
  );

  const logout = useCallback(() => {
    clearToken();
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginUser(email, password);
    setToken(data.access_token);
    setIsAuthenticated(true);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await registerUser(email, password);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
