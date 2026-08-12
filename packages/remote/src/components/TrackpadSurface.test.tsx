import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackpadSurface } from "./TrackpadSurface.js";

const mockMove = vi.hoisted(() => vi.fn());
const mockScroll = vi.hoisted(() => vi.fn());
const mockDispose = vi.hoisted(() => vi.fn());

vi.mock("../pointer-coalesce.js", async () => {
  const actual = await vi.importActual<typeof import("../pointer-coalesce.js")>("../pointer-coalesce.js");
  return {
    ...actual,
    createPointerCoalescer: vi.fn(() => ({
      move: mockMove,
      scroll: mockScroll,
      flush: vi.fn(),
      clear: vi.fn(),
      dispose: mockDispose,
    })),
  };
});

function makeTouch(id: number, x: number, y: number, target: Element) {
  return {
    identifier: id,
    clientX: x,
    clientY: y,
    pageX: x,
    pageY: y,
    screenX: x,
    screenY: y,
    target,
    radiusX: 0,
    radiusY: 0,
    rotationAngle: 0,
    force: 0,
  } as any;
}

function dispatchTouch(surface: Element, type: string, touches: any[]) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", { value: touches, configurable: true });
  Object.defineProperty(event, "changedTouches", { value: touches, configurable: true });
  surface.dispatchEvent(event);
}

describe("TrackpadSurface", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    mockMove.mockClear();
    mockScroll.mockClear();
    mockDispose.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("uses centroid deltas for two-finger scroll gestures", () => {
    act(() => {
      root.render(
        <TrackpadSurface
          client={{
            sendInput: vi.fn().mockResolvedValue({ ok: true }),
            onCursorPosition: vi.fn(),
          } as any}
          status="CONNECTED"
          onToast={vi.fn()}
        />,
      );
    });

    const surface = container.querySelector(".trackpad-surface") as HTMLDivElement;
    expect(surface).not.toBeNull();

    act(() => {
      dispatchTouch(surface, "touchstart", [
        makeTouch(0, 100, 100, surface),
        makeTouch(1, 200, 120, surface),
      ]);
      dispatchTouch(surface, "touchmove", [
        makeTouch(0, 100, 100, surface),
        makeTouch(1, 260, 140, surface),
      ]);
    });

    expect(mockScroll).toHaveBeenCalledWith(30, 10);
    expect(mockMove).not.toHaveBeenCalled();
  });
});
