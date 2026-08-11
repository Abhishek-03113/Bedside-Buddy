import { useEffect, useState } from "react";
import type { NavAction } from "@coosy/shared";
import { HomeScreen } from "./screens/HomeScreen";
import { PlayerOverlay } from "./screens/PlayerOverlay";

type Screen = "home" | "player";

/**
 * Surfaces:
 * 1. Launcher (home) — CoOSy UI
 * 2. Active source — native WebContentsView (main process); this renderer stays empty
 * 3. Temporary overlays — toast window in main while source is active
 *
 * No CoOSy "Loading…" gate — showSource attaches immediately; Netflix paints its own load.
 */
export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  const goHome = () => {
    setScreen("home");
    setActiveSourceId(null);
    void window.coosy?.showLauncher();
  };

  // Main-process Escape / host transitions (source view has focus).
  useEffect(() => {
    if (!window.coosy?.onContext) return;
    return window.coosy.onContext(({ mode, activeSourceId: id }) => {
      if (mode === "launcher") {
        setScreen("home");
        setActiveSourceId(null);
        return;
      }
      if (mode === "player" && id) {
        setActiveSourceId(id);
        setScreen("player");
      }
    });
  }, []);

  useEffect(() => {
    if (screen !== "player" || !window.coosy?.onNav) return;
    return window.coosy.onNav((action: NavAction) => {
      if (action === "home" || action === "back") goHome();
    });
  }, [screen]);

  if (screen === "player" && activeSourceId) {
    return <PlayerOverlay sourceId={activeSourceId} />;
  }

  return (
    <HomeScreen
      onSelectSource={(id) => {
        setActiveSourceId(id);
        setScreen("player");
        void window.coosy?.openSource(id).catch(() => {
          setActiveSourceId(null);
          setScreen("home");
        });
      }}
    />
  );
}
