import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getToken } from "../auth";

const EventStreamContext = createContext(0);

export function EventStreamProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const url = `${import.meta.env.VITE_API_BASE_URL}/events/stream?token=${token}`;
    const es = new EventSource(url);

    es.addEventListener("new_event", () => {
      setTick((t) => t + 1);
    });

    return () => {
      es.close();
    };
  }, []);

  return (
    <EventStreamContext.Provider value={tick}>
      {children}
    </EventStreamContext.Provider>
  );
}

export function useEventTick() {
  return useContext(EventStreamContext);
}
