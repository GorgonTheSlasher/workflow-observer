import { useCallback, useEffect, useState, type ReactNode } from "react";
import { exchangeLoginCode, loginDemo as loginDemoRequest, loginUser, registerUser } from "../api";
import { clearToken, getToken, setToken, setUnauthorizedHandler } from "../auth";
import { AuthContext } from "./auth-context";

const LOGIN_CODE_PARAM = "login_code";

// Read the code and strip it from the address bar right away, so it never sits in
// history. Done once per page load at module level, where StrictMode can't run it twice.
function takeLoginCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get(LOGIN_CODE_PARAM);
  if (!code) return null;

  params.delete(LOGIN_CODE_PARAM);
  const remaining = params.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${remaining ? `?${remaining}` : ""}`);
  return code;
}

const loginCode = takeLoginCodeFromUrl();
let loginCodeExchange: Promise<string> | null = null;

// Codes work once, so every caller (including StrictMode's second effect run) shares one request
function exchangeOnce(code: string): Promise<string> {
  loginCodeExchange ??= exchangeLoginCode(code).then((data) => data.access_token);
  return loginCodeExchange;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getToken()));
  const [isCompletingGithubLogin, setIsCompletingGithubLogin] = useState(loginCode !== null);
  const [githubLoginError, setGithubLoginError] = useState<string | null>(null);

  const logout = useCallback(() => {
    clearToken();
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  useEffect(() => {
    if (!loginCode) return;
    let cancelled = false;

    exchangeOnce(loginCode)
      .then((token) => {
        setToken(token);
        if (!cancelled) setIsAuthenticated(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setGithubLoginError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsCompletingGithubLogin(false);
      });

    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginUser(email, password);
    setToken(data.access_token);
    setIsAuthenticated(true);
  }, []);

  const loginDemo = useCallback(async () => {
    const data = await loginDemoRequest();
    setToken(data.access_token);
    setIsAuthenticated(true);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await registerUser(email, password);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isCompletingGithubLogin, githubLoginError, login, loginDemo, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
