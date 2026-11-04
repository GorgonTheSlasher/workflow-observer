import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// AuthContext reads the login code from the URL when the module loads, so each test sets
// the URL first and then imports a fresh copy of the module.
async function renderAuthAt(url: string) {
  window.history.replaceState({}, "", url);
  vi.resetModules();

  const api = await import("../api");
  const exchange = vi.spyOn(api, "exchangeLoginCode");
  const { AuthProvider } = await import("./AuthContext");
  const { useAuth } = await import("../hooks/useAuth");

  function Probe() {
    const auth = useAuth();
    return (
      <p>
        {auth.isCompletingGithubLogin ? "completing" : auth.isAuthenticated ? "signed in" : "signed out"}
        {auth.githubLoginError && ` | ${auth.githubLoginError}`}
      </p>
    );
  }

  return {
    exchange,
    render: () => render(<StrictMode><AuthProvider><Probe /></AuthProvider></StrictMode>),
  };
}

describe("GitHub login code exchange", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("swaps the code for a token once and removes it from the address bar", async () => {
    const { exchange, render } = await renderAuthAt("/?login_code=abc123&tab=dora");
    exchange.mockResolvedValue({ access_token: "jwt-token", token_type: "bearer" });

    render();

    expect(window.location.search).toBe("?tab=dora");
    await waitFor(() => expect(screen.getByText("signed in")).toBeInTheDocument());
    expect(exchange).toHaveBeenCalledTimes(1); // StrictMode runs effects twice; codes only work once
    expect(exchange).toHaveBeenCalledWith("abc123");
    expect(localStorage.getItem("wo_auth_token")).toBe("jwt-token");
  });

  it("shows the error when the code is rejected", async () => {
    const { exchange, render } = await renderAuthAt("/?login_code=expired");
    exchange.mockRejectedValue(new Error("Login code is invalid or expired"));

    render();

    await waitFor(() => expect(screen.getByText(/invalid or expired/)).toBeInTheDocument());
    expect(screen.getByText(/signed out/)).toBeInTheDocument();
    expect(localStorage.getItem("wo_auth_token")).toBeNull();
  });

  it("does nothing without a code", async () => {
    const { exchange, render } = await renderAuthAt("/");

    render();

    expect(screen.getByText("signed out")).toBeInTheDocument();
    expect(exchange).not.toHaveBeenCalled();
  });
});
