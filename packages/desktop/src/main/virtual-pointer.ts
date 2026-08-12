import type { BrowserWindow, WebContents } from "electron";
import type { CommandResult, InputCommand } from "@coosy/shared";
import { applyInputCommand, focusForInput, type CursorState } from "./source-input.js";
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

export interface PointerOverlayState {
  targetId: string | null;
  width: number;
  height: number;
  visible: boolean;
}

export interface VirtualPointerState extends CursorState, PointerOverlayState {}

const POINTER_MOVE_SCALE = 1.5;
const POINTER_IDLE_TIMEOUT_MS = 1500;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class VirtualPointerController {
  private target: VirtualPointerTarget | null = null;
  private state: CursorState = {
    x: 0,
    y: 0,
    primed: false,
    focused: false,
  };
  private overlayState: PointerOverlayState = {
    targetId: null,
    width: 0,
    height: 0,
    visible: false,
  };
  private readonly cursorOverlay: RemoteCursorOverlay;
  private hideTimer: NodeJS.Timeout | null = null;

  constructor(window: BrowserWindow) {
    this.cursorOverlay = new RemoteCursorOverlay(window);
  }

  dispose(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.cursorOverlay.dispose();
    this.target = null;
  }

  getState(): VirtualPointerState {
    return {
      ...this.state,
      ...this.overlayState,
    };
  }

  setTarget(target: VirtualPointerTarget | null): void {
    if (!target) {
      this.clearTarget();
      return;
    }

    const isSameTarget =
      this.target?.id === target.id && this.target?.contents === target.contents;
    this.target = target;
    if (!isSameTarget) {
      this.reset();
    } else {
      this.refreshTarget();
    }
    // Don't show pointer on setTarget — wait for actual interaction
    this.hidePointer();
  }

  clearTarget(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.target = null;
    this.state = { x: 0, y: 0, primed: false, focused: false };
    this.overlayState = { targetId: null, width: 0, height: 0, visible: false };
    this.cursorOverlay.hide();
  }

  show(): void {
    this.overlayState.visible = true;
    this.cursorOverlay.update({
      x: this.state.x,
      y: this.state.y,
      visible: true,
    });
  }

  hide(): void {
    this.overlayState.visible = false;
    this.cursorOverlay.update({
      x: this.state.x,
      y: this.state.y,
      visible: false,
    });
  }

  reset(): void {
    if (!this.target) return;
    const { width, height } = this.target.getSize();
    this.state = {
      x: Math.round(width / 2),
      y: Math.round(height / 2),
      primed: true,
      focused: false,
    };
    this.overlayState = {
      targetId: this.target.id,
      width,
      height,
      visible: false, // Start hidden — wait for interaction
    };
    this.cursorOverlay.update({ x: this.state.x, y: this.state.y, visible: false });
  }

  refreshTarget(): void {
    if (!this.target) return;
    const { width, height } = this.target.getSize();
    this.overlayState.width = width;
    this.overlayState.height = height;
    this.overlayState.targetId = this.target.id;
    this.state.x = clamp(this.state.x, 0, Math.max(0, width - 1));
    this.state.y = clamp(this.state.y, 0, Math.max(0, height - 1));
    this.cursorOverlay.update({ x: this.state.x, y: this.state.y, visible: this.overlayState.visible });
  }

  handleInput(command: InputCommand): CommandResult {
    if (!this.target) {
      return { ok: false, reason: "no-active-session" };
    }

    // Show pointer and reset idle timer for pointer interactions
    const isPointerInteraction =
      command.type === "pointer-move" ||
      command.type === "pointer-down" ||
      command.type === "pointer-up" ||
      command.type === "pointer-click" ||
      command.type === "pointer-scroll";

    if (isPointerInteraction) {
      this.showPointer();
    }

    if (command.type === "pointer-move" && !this.state.focused) {
      const focusErr = focusForInput(this.target, this.state);
      if (focusErr) return focusErr;
    }

    const result = applyInputCommand(this.target, this.state, command, {
      pointerMoveScale: POINTER_MOVE_SCALE,
    });
    this.cursorOverlay.update({ x: this.state.x, y: this.state.y, visible: this.overlayState.visible });
    return result;
  }

  private showPointer(): void {
    if (!this.overlayState.visible) {
      this.overlayState.visible = true;
      this.cursorOverlay.update({
        x: this.state.x,
        y: this.state.y,
        visible: true,
      });
    }
    this.resetHideTimer();
  }

  private resetHideTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }

    this.hideTimer = setTimeout(() => {
      this.hidePointer();
      this.hideTimer = null;
    }, POINTER_IDLE_TIMEOUT_MS);
  }

  private hidePointer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    if (this.overlayState.visible) {
      this.overlayState.visible = false;
      this.cursorOverlay.update({
        x: this.state.x,
        y: this.state.y,
        visible: false,
      });
    }
  }
}
