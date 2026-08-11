import { useEffect, useState } from "react";
import type { NavAction } from "@coosy/shared";
import { HomeScreen } from "./screens/HomeScreen";
import { LoadingScreen } from "./screens/LoadingScreen";
import { PlayerOverlay } from "./screens/PlayerOverlay";

type Screen = "home" | "loading" | "player";

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  const goHome = () => {
    setScreen("home");
    setActiveSourceId(null);
    void window.coosy?.showLauncher();
  };

  useEffect(() => {
    if (screen !== "player" || !window.coosy?.onNav) return;
    return window.coosy.onNav((action: NavAction) => {
      if (action === "home" || action === "back") goHome();
    });
  }, [screen]);

  if (screen === "loading") {
    return <LoadingScreen />;
  }

  if (screen === "player" && activeSourceId) {
    return (
      <PlayerOverlay sourceId={activeSourceId} onHome={goHome} />
    );
  }

  return (
    <HomeScreen
      onSelectSource={(id) => {
        setActiveSourceId(id);
        setScreen("loading");
        void window.coosy
          ?.openSource(id)
          .then(() => setScreen("player"))
          .catch(() => {
            setActiveSourceId(null);
            setScreen("home");
          });
      }}
    />
  );
}
