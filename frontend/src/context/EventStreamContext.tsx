import { useEffect, useState, type ReactNode } from "react";
import { getStreamUrl } from "../api";
import { getToken } from "../auth";
import { EventStreamContext } from "./event-stream-context";

const RETRY_MIN_MS = 2_000;
const RETRY_MAX_MS = 60_000;

export function EventStreamProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryMs = RETRY_MIN_MS;
    let stopped = false;

    function scheduleReconnect() {
      if (stopped) return;
      retryTimer = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    }

    async function connect() {
      if (stopped || !getToken()) return;

      let url: string;
      try {
        url = await getStreamUrl();
      } catch {
        // A 401 here already logs the user out; anything else (cold start, network) retries
        scheduleReconnect();
        return;
      }
      if (stopped) return;

      es = new EventSource(url);
      es.addEventListener("open", () => {
        retryMs = RETRY_MIN_MS;
      });
      es.addEventListener("new_event", () => {
        setTick((t) => t + 1);
      });
      es.addEventListener("error", () => {
        // EventSource would retry with the same URL, but the ticket in it has expired.
        // Close it and reconnect with a fresh ticket instead.
        es?.close();
        es = null;
        scheduleReconnect();
      });
    }

    connect();

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      es?.close();
    };
  }, []);

  return (
    <EventStreamContext.Provider value={tick}>
      {children}
    </EventStreamContext.Provider>
  );
}
