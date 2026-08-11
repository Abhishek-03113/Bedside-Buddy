import { useEffect, useState } from "react";

interface PlayerOverlayProps {
  sourceId: string;
  onHome: () => void;
}

/**
 * Chromeless overlay while a source WebContentsView is visible.
 * Toasts confirm remote command results (honest feedback).
 */
export function PlayerOverlay({ sourceId, onHome }: PlayerOverlayProps) {
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (!window.coosy?.onToast) return;
    let hideTimer: number | undefined;
    const unsubscribe = window.coosy.onToast((payload) => {
      setToast(payload);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setToast(null), 1500);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div className="player-overlay" data-source={sourceId}>
      <button type="button" className="player-overlay__home" onClick={onHome}>
        Home
      </button>
      {toast ? (
        <div
          className={`remote-toast ${toast.ok ? "remote-toast--ok" : "remote-toast--err"}`}
          role="status"
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
