import type { WsClient } from "../ws-client";

interface DPadScreenProps {
  client: WsClient;
}

export function DPadScreen({ client }: DPadScreenProps) {
  const press = (action: "up" | "down" | "left" | "right" | "select" | "back") =>
    void client.sendNav(action);

  return (
    <main className="remote">
      <h1 className="remote__title">CoOSy</h1>
      <p className="remote__hint">Navigate the TV launcher</p>

      <div className="dpad" role="group" aria-label="D-pad">
        <button type="button" className="dpad__btn dpad__up" onClick={() => press("up")}>
          ▲
        </button>
        <button type="button" className="dpad__btn dpad__left" onClick={() => press("left")}>
          ◀
        </button>
        <button
          type="button"
          className="dpad__btn dpad__select"
          onClick={() => press("select")}
        >
          OK
        </button>
        <button type="button" className="dpad__btn dpad__right" onClick={() => press("right")}>
          ▶
        </button>
        <button type="button" className="dpad__btn dpad__down" onClick={() => press("down")}>
          ▼
        </button>
      </div>

      <button type="button" className="remote__secondary" onClick={() => press("back")}>
        Back
      </button>
    </main>
  );
}
