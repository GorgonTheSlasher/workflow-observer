import { createContext } from "react";

export type AuthContextValue = {
  isAuthenticated: boolean;
  isCompletingGithubLogin: boolean;
  githubLoginError: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
