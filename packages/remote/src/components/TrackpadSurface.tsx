import { useEffect, useRef, useCallback } from 'react';
import { createPointerCoalescer, TRACKPAD_TAP_SLOP, TRACKPAD_TAP_MAX_MS } from '../pointer-coalesce';
import type { WsClient } from '../ws-client';
import type { InputCommand } from '@coosy/shared';

type ConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';

interface TrackpadSurfaceProps {
  client: WsClient;
  status: ConnectionStatus;
  onToast: (toast: { message: string; ok: boolean }) => void;
}

export function TrackpadSurface({ client, status, onToast }: TrackpadSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const touchState = useRef({
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastCenterX: 0,
    lastCenterY: 0,
    startTime: 0,
    isTwoFinger: false,
  });

  const coalescer = useRef<ReturnType<typeof createPointerCoalescer> | null>(null);

  const sendInput = useCallback((cmd: InputCommand, awaitResult = false) => {
    if (status !== 'CONNECTED') return;
    client.sendInput(cmd, { awaitResult }).catch(err => {
      onToast({ message: `Input error: ${err.message}`, ok: false });
    });
  }, [client, status, onToast]);

  useEffect(() => {
    coalescer.current = createPointerCoalescer({
      send: (cmd) => sendInput(cmd),
      isActive: () => statusRef.current === 'CONNECTED'
    });
    return () => {
      coalescer.current?.dispose();
    };
  }, [sendInput]);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    
    // Prevent default touch behaviors like scrolling and zooming
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    el.addEventListener('touchmove', prevent, { passive: false });
    el.addEventListener('touchend', prevent, { passive: false });
    el.addEventListener('touchcancel', prevent, { passive: false });
    
    return () => {
      el.removeEventListener('touchstart', prevent);
      el.removeEventListener('touchmove', prevent);
      el.removeEventListener('touchend', prevent);
      el.removeEventListener('touchcancel', prevent);
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0]!;
      let lastCenterX = touch.clientX;
      let lastCenterY = touch.clientY;
      if (e.touches.length >= 2) {
        const touch2 = e.touches[1]!;
        lastCenterX = (touch.clientX + touch2.clientX) / 2;
        lastCenterY = (touch.clientY + touch2.clientY) / 2;
      }
      touchState.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        lastCenterX,
        lastCenterY,
        startTime: Date.now(),
        isTwoFinger: e.touches.length >= 2,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 0 || !coalescer.current) return;

    const isTwoFinger = e.touches.length >= 2;
    if (isTwoFinger && !touchState.current.isTwoFinger) {
      touchState.current.isTwoFinger = true;
      const touch0 = e.touches[0]!;
      const touch1 = e.touches[1]!;
      touchState.current.lastCenterX = (touch0.clientX + touch1.clientX) / 2;
      touchState.current.lastCenterY = (touch0.clientY + touch1.clientY) / 2;
      return;
    }

    if (isTwoFinger) {
      const touch0 = e.touches[0]!;
      const touch1 = e.touches[1]!;
      const centerX = (touch0.clientX + touch1.clientX) / 2;
      const centerY = (touch0.clientY + touch1.clientY) / 2;
      const dx = centerX - touchState.current.lastCenterX;
      const dy = centerY - touchState.current.lastCenterY;
      touchState.current.lastCenterX = centerX;
      touchState.current.lastCenterY = centerY;
      coalescer.current.scroll(dx, dy);
      return;
    }

    const touch = e.touches[0]!;
    const dx = touch.clientX - touchState.current.lastX;
    const dy = touch.clientY - touchState.current.lastY;

    touchState.current.lastX = touch.clientX;
    touchState.current.lastY = touch.clientY;

    coalescer.current.move(dx, dy);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const { startX, startY, startTime, isTwoFinger } = touchState.current;
    if (isTwoFinger) return;
    
    if (e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0]!;
    
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const time = Date.now() - startTime;
    
    if (dist <= TRACKPAD_TAP_SLOP && time <= TRACKPAD_TAP_MAX_MS) {
      sendInput({ type: 'pointer-click', button: 'left' }, true);
    }
  };

  return (
    <div
      ref={surfaceRef}
      className="trackpad-surface"
      style={{
        flex: 1,
        width: '100%',
        backgroundColor: 'var(--muted)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onContextMenu={e => e.preventDefault()}
    >
      <span style={{ color: 'var(--fg)', fontSize: '1.2rem', fontWeight: 500, opacity: 0.5 }}>
        Trackpad
      </span>
      <span style={{ color: 'var(--fg)', fontSize: '0.85rem', opacity: 0.4, marginTop: '8px' }}>
        1 finger: move  ·  2 fingers: scroll  ·  tap: select
      </span>
    </div>
  );
}
