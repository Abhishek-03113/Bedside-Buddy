import { useCallback, useEffect, useRef, useState } from "react";
import { TOAST_DISMISS_MS } from "./remote-actions";

export interface RemoteToast {
  message: string;
  ok: boolean;
}

/**
 * Single toast slot with auto-dismiss. Replacing the message resets the timer
 * without allocating a toast stack.
 */
export function useRemoteToast(dismissMs = TOAST_DISMISS_MS) {
  const [toast, setToast] = useState<RemoteToast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissMsRef = useRef(dismissMs);
  dismissMsRef.current = dismissMs;

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(
    (next: RemoteToast) => {
      clearTimer();
      setToast(next);
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, dismissMsRef.current);
    },
    [clearTimer],
  );

  const clear = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { toast, show, clear };
}
