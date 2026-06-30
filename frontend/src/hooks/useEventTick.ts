import { useContext } from "react";
import { EventStreamContext } from "../context/event-stream-context";

export function useEventTick() {
  return useContext(EventStreamContext);
}
