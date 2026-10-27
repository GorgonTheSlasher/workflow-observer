import { useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { getGithubInstallUrl, getGithubLoginUrl } from "../api";

type Tab = "login" | "register";

export default function LoginPage() {
  const { login, loginDemo, register } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleTabChange(nextTab: Tab) {
    setTab(nextTab);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        await register(email, password);
        setNotice("Account created — you can now log in.");
        setTab("login");
        setPassword("");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDemo() {
    setError(null);
    setIsSubmitting(true);

    try {
      await loginDemo();
    } catch (err) {
      setError((err as Error).message);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-demo">
          <button
            type="button"
            className="login-demo__btn"
            onClick={handleDemo}
            disabled={isSubmitting}
          >
            Try the demo
          </button>
          <p className="login-demo__hint">No account needed. Explore a dashboard populated with sample repository data.</p>
        </div>

        <div className="login-divider">
          <span>or</span>
        </div>

        <div className="login-tabs">
          <button
            type="button"
            className={`login-tabs__item${tab === "login" ? " login-tabs__item--active" : ""}`}
            onClick={() => handleTabChange("login")}
          >
            Log In
          </button>
          <button
            type="button"
            className={`login-tabs__item${tab === "register" ? " login-tabs__item--active" : ""}`}
            onClick={() => handleTabChange("register")}
          >
            Register
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-form__field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="login-form__field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              required
            />
          </label>

          {notice && <p className="login-form__notice">{notice}</p>}
          {error && <p className="error">{error}</p>}

          <button type="submit" className="login-form__submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait..." : tab === "login" ? "Log In" : "Register"}
          </button>
        </form>

        <div className="login-divider">
          <span>or</span>
        </div>

        <div className="login-github">
          <button
            type="button"
            className="login-github-btn"
            onClick={() => { window.location.href = getGithubLoginUrl(); }}
          >
            Sign in with GitHub
          </button>
          <button
            type="button"
            className="login-github-btn login-github-btn--install"
            onClick={() => { window.location.href = getGithubInstallUrl(); }}
          >
            Install GitHub App
          </button>
        </div>
      </div>
    </div>
  );
}
