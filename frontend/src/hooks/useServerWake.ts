import { useEffect, useState } from "react";
import { pingServer } from "../api";

const SLOW_AFTER_MS = 2_000;
const RETRY_MS = 3_000;

type ServerWake = {
  isWaking: boolean;
  secondsWaiting: number;
};

// The backend's host sleeps when idle and takes up to a minute to start. Ping it on page
// load so it starts waking before the first real request, and report when that's slow.
export function useServerWake(): ServerWake {
  const [isWaking, setIsWaking] = useState(false);
  const [secondsWaiting, setSecondsWaiting] = useState(0);

  useEffect(() => {
    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const slowTimer = setTimeout(() => setIsWaking(true), SLOW_AFTER_MS);
    const ticker = setInterval(() => setSecondsWaiting(Math.floor((Date.now() - startedAt) / 1000)), 1_000);

    function stop() {
      stopped = true;
      clearTimeout(slowTimer);
      clearTimeout(retryTimer);
      clearInterval(ticker);
    }

    async function check() {
      // While starting, the host answers with errors, so keep retrying until a real 200
      if (await pingServer()) {
        if (!stopped) {
          stop();
          setIsWaking(false);
        }
        return;
      }
      if (!stopped) retryTimer = setTimeout(check, RETRY_MS);
    }

    check();
    return stop;
  }, []);

  return { isWaking, secondsWaiting };
}
