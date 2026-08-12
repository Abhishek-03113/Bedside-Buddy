import { describe, expect, it, vi } from "vitest";
import { applyInputCommand, createPointerCursorState } from "./source-input.js";

function makeTarget() {
  const contents = {
    isDestroyed: () => false,
    focus: vi.fn(),
    sendInputEvent: vi.fn(),
    insertText: vi.fn(),
  };
  const windowObj = {
    isFocused: vi.fn(() => true),
    focus: vi.fn(),
  };
  const view = { webContents: contents, getBounds: () => ({ width: 1200, height: 800 }) } as any;
  return { target: { window: windowObj as any, view }, contents, windowObj };
}

describe("source-input", () => {
  it("skips repeated focus calls during pointer-move bursts", () => {
    const { target, contents } = makeTarget();
    const cursor = createPointerCursorState();
    const focusSession = { focused: false };

    applyInputCommand(target, cursor, { type: "pointer-move", dx: 4, dy: 2 }, focusSession);
    applyInputCommand(target, cursor, { type: "pointer-move", dx: 3, dy: 1 }, focusSession);
    applyInputCommand(target, cursor, { type: "pointer-move", dx: -2, dy: 4 }, focusSession);

    expect(contents.focus).toHaveBeenCalledTimes(1);
  });

  it("inverts pointer-scroll wheel deltas to match Electron conventions", () => {
    const { target, contents } = makeTarget();
    const cursor = createPointerCursorState();

    applyInputCommand(target, cursor, {
      type: "pointer-scroll",
      dx: 10,
      dy: -5,
    });

    expect(contents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "mouseWheel",
        deltaX: -25,
        deltaY: 13,
      }),
    );
  });
});
