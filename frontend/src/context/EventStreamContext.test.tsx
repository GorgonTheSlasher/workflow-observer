import { act, render, screen } from "@testing-library/react";
import { useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { setToken } from "../auth";
import { EventStreamProvider } from "./EventStreamContext";
import { EventStreamContext } from "./event-stream-context";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  closed = false;
  private listeners: Record<string, (() => void)[]> = {};

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: () => void) {
    (this.listeners[type] ??= []).push(listener);
  }

  emit(type: string) {
    this.listeners[type]?.forEach((listener) => listener());
  }

  close() {
    this.closed = true;
  }
}

function TickProbe() {
  return <p>tick {useContext(EventStreamContext)}</p>;
}

describe("EventStreamProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    setToken("login-token");
    let n = 0;
    vi.spyOn(api, "getStreamUrl").mockImplementation(async () => `/events/stream?ticket=t${++n}`);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("connects with a ticket, never the login token", async () => {
    render(<EventStreamProvider><TickProbe /></EventStreamProvider>);
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe("/events/stream?ticket=t1");
    expect(FakeEventSource.instances[0].url).not.toContain("login-token");
  });

  it("bumps the tick on each new event", async () => {
    render(<EventStreamProvider><TickProbe /></EventStreamProvider>);
    await act(() => vi.advanceTimersByTimeAsync(0));

    act(() => FakeEventSource.instances[0].emit("new_event"));
    act(() => FakeEventSource.instances[0].emit("new_event"));

    expect(screen.getByText("tick 2")).toBeInTheDocument();
  });

  it("reconnects with a fresh ticket after an error", async () => {
    render(<EventStreamProvider><TickProbe /></EventStreamProvider>);
    await act(() => vi.advanceTimersByTimeAsync(0));

    act(() => FakeEventSource.instances[0].emit("error"));
    expect(FakeEventSource.instances[0].closed).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(2_000));

    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[1].url).toBe("/events/stream?ticket=t2");
  });

  it("closes the stream on unmount", async () => {
    const { unmount } = render(<EventStreamProvider><TickProbe /></EventStreamProvider>);
    await act(() => vi.advanceTimersByTimeAsync(0));

    unmount();

    expect(FakeEventSource.instances[0].closed).toBe(true);
  });
});
