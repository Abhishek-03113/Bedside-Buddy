import type { BrowserWindow, WebContents } from "electron";
import type { CommandResult, InputCommand } from "@coosy/shared";
import { applyInputCommand } from "./source-input.js";
import { RemoteCursorOverlay } from "./remote-cursor.js";

export interface VirtualPointerTarget {
  id: string;
  window: BrowserWindow;
  contents: WebContents;
  getSize(): {
    width: number;
    height: number;
  };
}

export interface VirtualPointerState {
  targetId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  primed: boolean;
  focused: boolean;
}

const POINTER_MOVE_SCALE = 1.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class VirtualPointerController {
  private target: VirtualPointerTarget | null = null;
  private state: VirtualPointerState = {
    targetId: null,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: false,
    primed: false,
    focused: false,
  };
  private readonly cursorOverlay: RemoteCursorOverlay;

  constructor(window: BrowserWindow) {
    this.cursorOverlay = new RemoteCursorOverlay(window);
  }

  dispose(): void {
    this.cursorOverlay.dispose();
    this.target = null;
  }

  getState(): VirtualPointerState {
    return { ...this.state };
  }

  setTarget(target: VirtualPointerTarget): void {
    const isSameTarget =
      this.target?.id === target.id && this.target?.contents === target.contents;
    this.target = target;
    if (!isSameTarget) {
      this.reset();
    } else {
      this.refreshTarget();
    }
    this.show();
  }

  clearTarget(): void {
    this.target = null;
    this.state = {
      targetId: null,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      visible: false,
      primed: false,
      focused: false,
    };
    this.cursorOverlay.hide();
  }

  show(): void {
    this.state.visible = true;
    this.cursorOverlay.update(this.state);
  }

  hide(): void {
    this.state.visible = false;
    this.cursorOverlay.update(this.state);
  }

  reset(): void {
    if (!this.target) return;
    const { width, height } = this.target.getSize();
    this.state = {
      targetId: this.target.id,
      x: Math.round(width / 2),
      y: Math.round(height / 2),
      width,
      height,
      visible: true,
      primed: true,
      focused: false,
    };
    this.cursorOverlay.update(this.state);
  }

  refreshTarget(): void {
    if (!this.target) return;
    const { width, height } = this.target.getSize();
    this.state.width = width;
    this.state.height = height;
    this.state.x = clamp(this.state.x, 0, Math.max(0, width - 1));
    this.state.y = clamp(this.state.y, 0, Math.max(0, height - 1));
    this.cursorOverlay.update(this.state);
  }

  handleInput(command: InputCommand): CommandResult {
    if (!this.target) {
      return { ok: false, reason: "no-active-session" };
    }
    const result = applyInputCommand(this.target, this.state, command, {
      pointerMoveScale: POINTER_MOVE_SCALE,
    });
    this.cursorOverlay.update(this.state);
    return result;
  }
}
