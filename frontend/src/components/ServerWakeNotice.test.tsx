import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import ServerWakeNotice from "./ServerWakeNotice";

describe("ServerWakeNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays hidden when the server answers quickly", async () => {
    vi.spyOn(api, "pingServer").mockResolvedValue(true);
    render(<ServerWakeNotice />);

    await act(() => vi.advanceTimersByTimeAsync(5_000));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("appears while the server is starting and goes away once it answers", async () => {
    let answer: (ok: boolean) => void = () => {};
    vi.spyOn(api, "pingServer").mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    render(<ServerWakeNotice />);

    await act(() => vi.advanceTimersByTimeAsync(2_500));
    expect(screen.getByRole("status")).toHaveTextContent("Waking up the server");

    await act(async () => answer(true));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps retrying while the host returns errors", async () => {
    const ping = vi.spyOn(api, "pingServer")
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    render(<ServerWakeNotice />);

    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(screen.getByRole("status")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(6_000));
    expect(ping).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
