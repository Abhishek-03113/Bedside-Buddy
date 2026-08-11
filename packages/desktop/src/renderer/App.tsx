import { useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { LoadingScreen } from "./screens/LoadingScreen";
import { PlayerOverlay } from "./screens/PlayerOverlay";

type Screen = "home" | "loading" | "player";

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  if (screen === "loading") {
    return <LoadingScreen />;
  }

  if (screen === "player" && activeSourceId) {
    return (
      <PlayerOverlay
        sourceId={activeSourceId}
        onHome={() => {
          setScreen("home");
          setActiveSourceId(null);
          void window.coosy?.showLauncher();
        }}
      />
    );
  }

  return (
    <HomeScreen
      onSelectSource={(id) => {
        setActiveSourceId(id);
        setScreen("loading");
        void window.coosy?.openSource(id).then(() => setScreen("player"));
      }}
    />
  );
}
