import { useEffect, useRef, useState } from "react";

const VERSION_URL = `${import.meta.env.BASE_URL}version.json`;
const POLL_INTERVAL_MS = 60_000;
const COUNTDOWN_SECONDS = 5;

async function fetchVersion(): Promise<string | null> {
  try {
    const r = await fetch(`${VERSION_URL}?ts=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { version?: string };
    return j.version ?? null;
  } catch {
    return null;
  }
}

export function useAutoUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const initialVersionRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (cancelled) return;
      const v = await fetchVersion();
      if (cancelled || !v) return;
      if (initialVersionRef.current === null) {
        initialVersionRef.current = v;
        return;
      }
      if (v !== initialVersionRef.current) {
        setUpdateAvailable(true);
      }
    };

    check();
    timerRef.current = window.setInterval(check, POLL_INTERVAL_MS) as unknown as number;

    const onFocus = () => check();
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!updateAvailable) return;
    setCountdown(COUNTDOWN_SECONDS);
    countdownRef.current = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          window.location.reload();
          return 0;
        }
        return c - 1;
      });
    }, 1000) as unknown as number;
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [updateAvailable]);

  const reloadNow = () => window.location.reload();

  return { updateAvailable, countdown, reloadNow };
}
