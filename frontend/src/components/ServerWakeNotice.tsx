import { useServerWake } from "../hooks/useServerWake";

export default function ServerWakeNotice() {
  const { isWaking, secondsWaiting } = useServerWake();

  if (!isWaking) return null;

  return (
    <div className="wake-notice" role="status" aria-live="polite">
      <span className="wake-notice__spinner" aria-hidden="true" />
      <span>
        Waking up the server. It sleeps when idle and can take up to a minute to start.
        <span className="wake-notice__elapsed"> {secondsWaiting}s</span>
      </span>
    </div>
  );
}
